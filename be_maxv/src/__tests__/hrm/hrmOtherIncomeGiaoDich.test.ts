/* eslint-disable @typescript-eslint/no-explicit-any -- DB giả mô phỏng Prisma: kiểu lỏng có chủ đích */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOtherIncome,
  deleteOtherIncome,
  updateOtherIncome,
} from '../../services/client/hrm/to_khai_thue/otherIncomeRecord.service';
import { ToKhaiThueError } from '../../helpers/hrm/toKhaiThueErrors';

/**
 * RVW-722 — thêm / sửa / xóa khoản ngoài lương đua với Chốt tháng. Trước đây khóa `TAX_SHEET` được kiểm bằng
 * lệnh đọc thường NGOÀI giao dịch: Chốt tháng commit chen giữa lúc kiểm và lúc ghi thì khoản vẫn lọt vào tháng
 * đã chốt (hoặc bị xóa khỏi tháng trong khi snapshot còn giữ). Nay mọi đường ghi mở giao dịch bằng khóa CHIA SẺ
 * dòng kỳ (`FOR SHARE`) rồi mới kiểm khóa — Chốt tháng giữ `FOR UPDATE` trên cùng dòng nên hai bên xếp hàng.
 *
 * Ngữ nghĩa khóa hàng thật là của Postgres; ở đây kiểm THỨ TỰ: khóa dòng kỳ → kiểm khóa tháng → ghi, cùng giao dịch.
 */

function taoDb(tc: { khoaThang?: boolean; coKy?: boolean } = {}) {
  const nhatKy: string[] = [];
  const hang = (data: any) => ({
    id: 'oir-1',
    periodId: 'p-9',
    ...data,
    category: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const db: any = {
    nhatKy,
    $transaction: async (fn: (tx: unknown) => unknown) => {
      nhatKy.push('BEGIN');
      try {
        return await fn(db);
      } finally {
        nhatKy.push('END');
      }
    },
    $queryRaw: async (strings: TemplateStringsArray) => {
      const cau = strings.join('?');
      nhatKy.push(
        /hrm_payroll_periods/.test(cau) && /FOR SHARE/.test(cau)
          ? 'FOR SHARE kỳ'
          : cau,
      );
      return tc.coKy === false ? [] : [{ id: 'p-9' }];
    },
    payrollModuleLock: {
      findFirst: async () => {
        nhatKy.push('kiểm khóa tháng');
        return tc.khoaThang ? { id: 'khoa' } : null;
      },
    },
    payrollPeriod: {
      findUnique: async () => ({ year: 2026, month: 9 }),
    },
    otherIncomeCategory: {
      findUnique: async () => ({
        id: 'dm-12',
        name: 'Thù lao cộng tác viên',
        status: 'ACTIVE',
        taxTreatmentGroup: 'WITHHOLDING_FLAT',
        exemptCapAmount: null,
        exemptCapPeriod: null,
        withholdingRate: 10,
        withholdingThreshold: 5_000_000,
      }),
    },
    otherIncomeRecord: {
      findUnique: async () => ({ periodId: 'p-9' }),
      create: async ({ data }: any) => {
        nhatKy.push('ghi');
        return hang(data);
      },
      update: async ({ data }: any) => {
        nhatKy.push('ghi');
        return hang(data);
      },
      delete: async () => {
        nhatKy.push('ghi');
      },
    },
  };
  return db;
}

const KHOAN = {
  ma_nv: null,
  fullName: 'Nguyễn Văn Hùng',
  otherIncomeCategoryId: 'dm-12',
  paymentDate: '2026-09-10',
  amount: 6_000_000,
};

const GHI = {
  them: (db: any) => createOtherIncome(db, { periodId: 'p-9', ...KHOAN }),
  sua: (db: any) => updateOtherIncome(db, 'oir-1', KHOAN),
  xoa: (db: any) => deleteOtherIncome(db, 'oir-1'),
};

const loiMa = (ma: string) => (e: unknown) =>
  e instanceof ToKhaiThueError && e.code === ma;

test('RVW-722: thêm / sửa / xóa khóa CHIA SẺ dòng kỳ rồi mới kiểm khóa tháng và ghi — cùng MỘT giao dịch', async () => {
  for (const [ten, ghi] of Object.entries(GHI)) {
    const db = taoDb();
    await ghi(db);
    const i = (buoc: string) => db.nhatKy.indexOf(buoc);
    assert.ok(
      i('BEGIN') === 0 &&
        i('BEGIN') < i('FOR SHARE kỳ') &&
        i('FOR SHARE kỳ') < i('kiểm khóa tháng') &&
        i('kiểm khóa tháng') < i('ghi') &&
        i('ghi') < i('END'),
      `${ten}: ${db.nhatKy.join(' > ')}`,
    );
  }
});

test('RVW-722: tháng đã chốt lúc giữ được khóa dòng kỳ -> 403 E-tkt-007, không ghi gì', async () => {
  for (const [ten, ghi] of Object.entries(GHI)) {
    const db = taoDb({ khoaThang: true });
    await assert.rejects(ghi(db), loiMa('E-tkt-007'), ten);
    assert.ok(!db.nhatKy.includes('ghi'), `${ten}: ${db.nhatKy.join(' > ')}`);
  }
});

test('Kỳ không còn tồn tại lúc giữ khóa dòng kỳ -> 400 E-tkt-017, không ghi gì', async () => {
  for (const [ten, ghi] of Object.entries(GHI)) {
    const db = taoDb({ coKy: false });
    await assert.rejects(ghi(db), loiMa('E-tkt-017'), ten);
    assert.ok(!db.nhatKy.includes('ghi'), ten);
  }
});

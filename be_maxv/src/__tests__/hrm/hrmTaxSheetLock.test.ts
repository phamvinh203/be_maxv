import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma, type PrismaClient } from '../../generated/tenant';
import {
  lockTaxSheet,
  unlockTaxSheet,
} from '../../services/client/hrm/to_khai_thue/taxSheet.service';
import { ToKhaiThueError } from '../../helpers/hrm/toKhaiThueErrors';
import { bocNgoaiGiaoDich, soatNgoaiGiaoDich } from '../_hoTro/giaoDichGia';
import type { ToKhaiThueErrorCode } from '../../constants/hrm/to_khai_thue/toKhaiThueErrors';

/**
 * Chốt / Mở lại Bảng tính thuế tháng (api-contract Mục 4.2–4.3, ADR-013 tầng tháng).
 *
 * Số liệu từng dòng đã kiểm ở `hrmTaxSheetRows.test.ts`. Ở đây kiểm thứ giả lập DB bắt được:
 * thứ tự kiểm lỗi, THỨ TỰ GHI (khóa trước dòng) và việc KHÔNG ghi gì khi bị chặn. Ngữ nghĩa lùi
 * giao dịch là việc của Postgres — phần đó để test HTTP ở Phase B.
 */

const KY_DA_KHOA = {
  id: 'ky-2026-09',
  name: 'Tháng 9/2026',
  year: 2026,
  month: 9,
  startDate: new Date('2026-09-01T00:00:00.000Z'),
  endDate: new Date('2026-09-30T00:00:00.000Z'),
  status: 'LOCKED',
};

interface TuyChon {
  ky?: Record<string, unknown> | null;
  daChot?: boolean;
  loiGhiKhoa?: unknown;
  soKhoaXoaDuoc?: number;
  trangThaiToKhaiQuy?: string[];
}

function giaLapDb(tc: TuyChon = {}) {
  const daGhi: string[] = [];
  const doiSo: Record<string, unknown> = {};
  // Thứ tự mở giao dịch / khóa dòng kỳ / đọc kỳ — RVW-721/722.
  const nhatKy: string[] = [];
  let dangGiaoDich = false;
  const ghi =
    (ten: string, ketQua?: unknown) =>
    async (arg?: unknown): Promise<unknown> => {
      daGhi.push(ten);
      doiSo[ten] = arg;
      if (ten === 'khoa.create' && tc.loiGhiKhoa) throw tc.loiGhiKhoa;
      return ketQua;
    };

  const db = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      const cau = strings.join('?');
      nhatKy.push(
        /hrm_payroll_periods/.test(cau) && /FOR UPDATE/.test(cau)
          ? 'FOR UPDATE kỳ'
          : cau,
      );
      return [];
    },
    payrollPeriod: {
      findUnique: async () => {
        nhatKy.push('đọc kỳ');
        return tc.ky === undefined ? KY_DA_KHOA : tc.ky;
      },
    },
    payrollModuleLock: {
      findUnique: async () =>
        tc.daChot ? { lockedByUserId: 'u-khac', lockedAt: new Date() } : null,
      create: ghi('khoa.create'),
      deleteMany: ghi('khoa.deleteMany', { count: tc.soKhoaXoaDuoc ?? 1 }),
    },
    taxPolicy: {
      findFirst: async () => ({
        id: 'tp-2026',
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        personalDeduction: new Prisma.Decimal(15_500_000),
        dependentDeduction: new Prisma.Decimal(6_200_000),
        taxBrackets: [
          { khoang: 10_000_000, thueSuat: 5 },
          { khoang: 30_000_000, thueSuat: 10 },
          { khoang: 60_000_000, thueSuat: 20 },
          { khoang: 100_000_000, thueSuat: 30 },
          { khoang: null, thueSuat: 35 },
        ],
      }),
    },
    // Kỳ lương đã khóa sổ ⇒ đọc snapshot lương, số là Decimal đúng như DB thật trả về.
    payrollSheetLine: {
      findMany: async () => [
        {
          ma_nv: 'NV0001',
          fullName: 'Nguyễn Văn A',
          grossIncome: new Prisma.Decimal(20_000_000),
          otTaxExemptAmount: new Prisma.Decimal(0),
          lunchAllowanceExemptAmount: new Prisma.Decimal(0),
          otherAllowanceTaxExemptAmount: new Prisma.Decimal(0),
          employeeInsuranceDeduction: new Prisma.Decimal(2_100_000),
          contractType: 'khong_xac_dinh',
          personalIncomeTax: new Prisma.Decimal(120_000),
        },
      ],
    },
    otherIncomeRecord: { findMany: async () => [] },
    hrm_nhan_vien: {
      findMany: async () => [
        {
          ma_nv: 'NV0001',
          ho_ten: 'Nguyễn Văn A',
          mst_ca_nhan: null,
          so_cccd: null,
          hop_dong: [{ loai_hd: 'khong_xac_dinh', tinh_tncn: true }],
          nguoi_phu_thuoc: [],
        },
      ],
    },
    taxCalculationLine: {
      deleteMany: ghi('dong.deleteMany'),
      createMany: ghi('dong.createMany'),
    },
    hrm_to_khai_tncn05: {
      findMany: async () =>
        (tc.trangThaiToKhaiQuy ?? []).map((trang_thai) => ({ trang_thai })),
      deleteMany: ghi('toKhai.deleteMany'),
    },
    $transaction: async (
      fn: (tx: unknown) => Promise<unknown>,
    ): Promise<unknown> => {
      nhatKy.push('BEGIN');
      dangGiaoDich = true;
      try {
        return await fn(db);
      } finally {
        dangGiaoDich = false;
        soatNgoaiGiaoDich(nhatKy);
      }
    },
  };
  // Service nhận bản BỌC, còn `tx` là `db` gốc (RVW-733).
  return {
    db: bocNgoaiGiaoDich(
      db,
      nhatKy,
      () => dangGiaoDich,
    ) as unknown as PrismaClient,
    daGhi,
    doiSo,
    nhatKy,
  };
}

const loiMa = (ma: ToKhaiThueErrorCode) => (e: unknown) =>
  e instanceof ToKhaiThueError && e.code === ma;

/* ── Chốt (FR-tkt-011) ─────────────────────────────────────────────── */

test('RVW-721/722: Chốt khóa GHI dòng kỳ lương ngay đầu giao dịch, TRƯỚC khi đọc trạng thái kỳ', async () => {
  const { db, nhatKy } = giaLapDb();
  await lockTaxSheet(db, KY_DA_KHOA.id, 'u-1');
  // Đọc trạng thái trước khi giữ khóa là đọc bản chụp có thể đã cũ: mở lại kỳ lương chen giữa thì Bảng tính
  // thuế được chốt trên một kỳ đã về DRAFT (AC-tkt-018); lượt ghi khoản ngoài lương đang dở thì lọt khỏi snapshot.
  assert.deepEqual(nhatKy.slice(0, 3), ['BEGIN', 'FOR UPDATE kỳ', 'đọc kỳ']);
});

test('Chốt: kỳ không tồn tại -> E-tkt-017', async () => {
  const { db } = giaLapDb({ ky: null });
  await assert.rejects(lockTaxSheet(db, 'khong-co', 'u-1'), loiMa('E-tkt-017'));
});

test('Chốt: kỳ lương chưa khóa sổ -> E-tkt-008, không ghi gì (AC-tkt-018)', async () => {
  for (const status of ['DRAFT', 'PENDING_REVIEW']) {
    const { db, daGhi } = giaLapDb({ ky: { ...KY_DA_KHOA, status } });
    await assert.rejects(
      lockTaxSheet(db, KY_DA_KHOA.id, 'u-1'),
      loiMa('E-tkt-008'),
    );
    assert.deepEqual(daGhi, [], status);
  }
});

test('Chốt: tháng đã chốt -> E-tkt-018, không ghi gì', async () => {
  const { db, daGhi } = giaLapDb({ daChot: true });
  await assert.rejects(
    lockTaxSheet(db, KY_DA_KHOA.id, 'u-1'),
    loiMa('E-tkt-018'),
  );
  assert.deepEqual(daGhi, []);
});

test('Chốt: ghi khóa TRƯỚC dòng; dòng ghim biểu thuế + phiên bản + người chốt; Decimal đã chuẩn hóa', async () => {
  const { db, daGhi, doiSo } = giaLapDb();
  const kq = await lockTaxSheet(db, KY_DA_KHOA.id, 'u-1');

  assert.deepEqual(daGhi, [
    'khoa.create',
    'dong.deleteMany',
    'dong.createMany',
  ]);
  assert.equal(kq.trangThai, 'DA_CHOT');
  assert.equal(kq.soDong, 1);
  assert.equal(kq.taxPolicyId, 'tp-2026');

  const [dong] = (
    doiSo['dong.createMany'] as { data: Record<string, unknown>[] }
  ).data;
  assert.equal(dong.periodId, KY_DA_KHOA.id);
  assert.equal(dong.recipientKey, 'NV0001');
  assert.equal(dong.taxPolicyId, 'tp-2026');
  assert.equal(
    dong.engineVersion,
    'v2',
    'v2 = vãng lai gộp theo CCCD → MST → họ tên (RVW-732)',
  );
  assert.equal(dong.lockedByUserId, 'u-1');
  // 20tr − 15,5tr bản thân − 2,1tr BH = 2,4tr ⇒ bậc 5% = 120.000. Decimal chưa chuẩn hóa sẽ ra
  // chuỗi nối hoặc NaN chứ không ra số này.
  assert.equal(dong.thu_nhap_tinh_thue, 2_400_000);
  assert.equal(dong.thue_luy_tien, 120_000);
});

test('Chốt: hai người cùng bấm -> người sau vỡ unique thành E-tkt-018, không ghi dòng nào', async () => {
  const { db, daGhi } = giaLapDb({ loiGhiKhoa: { code: 'P2002' } });
  await assert.rejects(
    lockTaxSheet(db, KY_DA_KHOA.id, 'u-2'),
    loiMa('E-tkt-018'),
  );
  assert.deepEqual(daGhi, ['khoa.create']);
});

/* ── Mở lại (FR-tkt-012) ───────────────────────────────────────────── */

test('Mở lại: tháng chưa chốt -> E-tkt-018', async () => {
  const { db, daGhi } = giaLapDb({ soKhoaXoaDuoc: 0 });
  await assert.rejects(unlockTaxSheet(db, KY_DA_KHOA.id), loiMa('E-tkt-018'));
  assert.deepEqual(daGhi, ['khoa.deleteMany']);
});

test('Mở lại: quý đã xuất -> E-tkt-009, không xóa dòng hay tờ khai (AC-tkt-021)', async () => {
  for (const trangThai of ['EXPORTED', 'SUBMITTED']) {
    const { db, daGhi } = giaLapDb({
      trangThaiToKhaiQuy: ['READY_TO_EXPORT', trangThai],
    });
    await assert.rejects(unlockTaxSheet(db, KY_DA_KHOA.id), loiMa('E-tkt-009'));
    assert.deepEqual(daGhi, ['khoa.deleteMany'], trangThai);
  }
});

test('Mở lại: quý đang sẵn sàng xuất -> xóa dòng + tờ khai chưa xuất của ĐÚNG quý (GAP-QA-tkt-06)', async () => {
  const { db, daGhi, doiSo } = giaLapDb({
    trangThaiToKhaiQuy: ['READY_TO_EXPORT'],
  });
  const kq = await unlockTaxSheet(db, KY_DA_KHOA.id);

  assert.deepEqual(kq, { periodId: KY_DA_KHOA.id, trangThai: 'NHAP' });
  assert.deepEqual(daGhi, [
    'khoa.deleteMany',
    'dong.deleteMany',
    'toKhai.deleteMany',
  ]);
  const { where } = doiSo['toKhai.deleteMany'] as {
    where: {
      nam: number;
      ky_loai: string;
      ky_so: number;
      trang_thai: { notIn: string[] };
    };
  };
  assert.equal(where.nam, 2026);
  assert.equal(where.ky_loai, 'quy');
  assert.equal(where.ky_so, 3, 'tháng 9 thuộc quý 3');
  assert.deepEqual(
    [...where.trang_thai.notIn].sort(),
    ['EXPORTED', 'SUBMITTED'],
    'chỉ xóa tờ khai CHƯA xuất',
  );
});

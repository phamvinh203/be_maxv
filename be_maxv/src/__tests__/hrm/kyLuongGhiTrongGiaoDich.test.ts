/* eslint-disable @typescript-eslint/no-explicit-any -- DB giả mô phỏng Prisma: kiểu lỏng có chủ đích */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOvertime,
  deleteEmployeeOvertime,
  overrideAttendanceCell,
  recordDiligenceViolation,
} from '../../services/client/hrm/du_lieu_tinh_luong/payrollInputs.service';
import {
  lockAllPayrollModules,
  lockPayrollModule,
} from '../../services/client/hrm/du_lieu_tinh_luong/payrollClosing.service';

/**
 * vbsec 2026-09-10 (LOW, payrollInputs.service.ts:256): guard khóa kỳ (`assertPayrollModuleWritable`) chạy
 * NGOÀI giao dịch ghi — khóa sổ kỳ / chốt số bảng kê chen vào giữa lúc kiểm và lúc ghi thì dữ liệu vẫn
 * lọt vào kỳ đã khóa (bảng lương đã chụp) / bảng kê đã chốt. Sửa:
 *  - lượt ghi dữ liệu kiểm LẠI trong giao dịch, giữ khóa CHIA SẺ (`FOR SHARE`) trên dòng kỳ tới lúc commit
 *    (khóa sổ là UPDATE dòng kỳ -> phải chờ; lượt ghi đến sau thấy trạng thái mới);
 *  - chốt số bảng kê khóa dòng kỳ `FOR UPDATE` trong CÙNG giao dịch với lệnh ghi khóa bảng kê (chèn dòng
 *    bảng khác không đụng dòng kỳ nên nếu không khóa thì không chờ ai).
 *
 * DB tenant giả: `findUnique` (bước kiểm trước, ngoài giao dịch) thấy kỳ còn mở; ngay sau đó "người khác"
 * khóa sổ / chốt số — giao dịch ghi đọc lại bằng `$queryRaw` phải thấy trạng thái mới.
 */

type Ky = { id: string; status: string };

function taoDb(
  opts: { sauKhiKiemTruoc?: (s: { ky: Ky; locks: Set<string> }) => void } = {},
) {
  const ky: Ky = { id: 'p-1', status: 'DRAFT' };
  const locks = new Set<string>(); // module đã chốt
  const daGhi: string[] = [];
  const sql: string[] = [];
  const nhatKy: string[] = [];
  let daKiemTruoc = false;

  const db: any = {
    ky,
    locks,
    daGhi,
    sql,
    nhatKy,
    $transaction: async (fn: (tx: unknown) => unknown) => {
      nhatKy.push('BEGIN');
      try {
        return await fn(db);
      } finally {
        nhatKy.push('COMMIT');
      }
    },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const cau = strings.join('?');
      sql.push(cau);
      nhatKy.push(
        /FOR UPDATE/.test(cau)
          ? 'FOR UPDATE'
          : /FOR SHARE/.test(cau)
            ? 'FOR SHARE'
            : 'SELECT',
      );
      return values[0] === ky.id ? [{ status: ky.status }] : [];
    },
    payrollPeriod: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const kq = where.id === ky.id ? { id: ky.id, status: ky.status } : null;
        if (!daKiemTruoc) {
          daKiemTruoc = true;
          // Sau khi bước kiểm trước đọc XONG cả dòng kỳ lẫn khóa bảng kê (hai lượt đọc chạy song song).
          queueMicrotask(() => opts.sauKhiKiemTruoc?.({ ky, locks }));
        }
        return kq;
      },
    },
    payrollModuleLock: {
      findUnique: async ({ where }: any) =>
        locks.has(where.periodId_module.module) ? { id: 'lock' } : null,
      create: async ({ data }: any) => {
        nhatKy.push(`create ${data.module}`);
        locks.add(data.module);
        return { id: 'lock', ...data };
      },
      createManyAndReturn: async ({ data }: any) => {
        nhatKy.push('createMany');
        const vua = data.filter((d: any) => !locks.has(d.module));
        for (const d of vua) locks.add(d.module);
        return vua.map((d: any) => ({ module: d.module }));
      },
    },
    generalSetting: { findFirst: async () => null },
    hrm_nhan_vien: {
      findMany: async () => [{ ma_nv: 'NV01', ho_ten: 'A', ma_pb: 'PB01' }],
    },
    overtimeRecord: {
      deleteMany: async () => {
        daGhi.push('overtime.deleteMany');
        return { count: 0 };
      },
      createMany: async () => {
        daGhi.push('overtime.createMany');
        return { count: 1 };
      },
    },
    attendanceRecord: {
      upsert: async () => {
        daGhi.push('attendance.upsert');
        return {};
      },
    },
    diligenceRecord: {
      findUnique: async () => null,
      create: async () => {
        daGhi.push('diligence.create');
        return {};
      },
    },
  };
  return db;
}

const khoaSoChenGiua = {
  sauKhiKiemTruoc: ({ ky }: { ky: Ky }) => void (ky.status = 'LOCKED'),
};

const GHI = {
  tangCa: (db: any) =>
    applyOvertime(db, {
      periodId: 'p-1',
      scope: 'toan_cong_ty',
      items: [{ otType: 'ngay_thuong_ngay', hours: 2 }],
    } as never),
  xoaTangCa: (db: any) => deleteEmployeeOvertime(db, 'p-1', 'NV01'),
  chamCong: (db: any) =>
    overrideAttendanceCell(db, {
      periodId: 'p-1',
      ma_nv: 'NV01',
      workDate: '2026-09-03',
      attendanceType: 'nghi_phep',
    } as never),
  chuyenCan: (db: any) =>
    recordDiligenceViolation(db, {
      periodId: 'p-1',
      ma_nv: 'NV01',
      violationTypeId: 'vt-1',
      violationDate: '2026-09-03',
    } as never),
};

test('khóa sổ chen giữa lúc kiểm và lúc ghi -> 403 E-dltl-001, KHÔNG ghi dữ liệu vào kỳ đã khóa', async () => {
  for (const [ten, ghi] of Object.entries(GHI)) {
    const db = taoDb(khoaSoChenGiua);
    await assert.rejects(
      ghi(db),
      (e: any) => e?.code === 'E-dltl-001' && e.statusCode === 403,
      ten,
    );
    assert.deepEqual(db.daGhi, [], ten);
  }
});

test('chốt số bảng kê chen giữa lúc kiểm và lúc ghi -> 403 E-dltl-027, KHÔNG ghi dữ liệu', async () => {
  const cases: Array<[string, (db: any) => Promise<unknown>, string]> = [
    ['tangCa', GHI.tangCa, 'OVERTIME'],
    ['chamCong', GHI.chamCong, 'ATTENDANCE'],
  ];
  for (const [ten, ghi, module] of cases) {
    const db = taoDb({
      sauKhiKiemTruoc: ({ locks }) => void locks.add(module),
    });
    await assert.rejects(
      ghi(db),
      (e: any) => e?.code === 'E-dltl-027' && e.statusCode === 403,
      ten,
    );
    assert.deepEqual(db.daGhi, [], ten);
  }
});

test('lượt ghi giữ khóa CHIA SẺ trên dòng kỳ trong giao dịch (các lượt ghi không chặn nhau)', async () => {
  const db = taoDb();
  await GHI.tangCa(db);
  assert.ok(
    db.sql.some(
      (c: string) => /hrm_payroll_periods/.test(c) && /FOR SHARE/.test(c),
    ),
    `SQL đã chạy: ${db.sql.join(' | ')}`,
  );
  const i = db.nhatKy.indexOf('FOR SHARE');
  assert.ok(
    i > db.nhatKy.indexOf('BEGIN') && i < db.nhatKy.lastIndexOf('COMMIT'),
    db.nhatKy.join(' > '),
  );
});

test('chốt số bảng kê (1 bảng / toàn kỳ) khóa dòng kỳ FOR UPDATE trong CÙNG giao dịch với lệnh chốt', async () => {
  const db1 = taoDb();
  await lockPayrollModule(db1, 'p-1', 'OVERTIME' as never, 'u-1');
  assert.deepEqual(db1.nhatKy.slice(-4), [
    'BEGIN',
    'FOR UPDATE',
    'create OVERTIME',
    'COMMIT',
  ]);

  const db2 = taoDb();
  await lockAllPayrollModules(db2, 'p-1', 'u-1');
  assert.deepEqual(db2.nhatKy.slice(-4), [
    'BEGIN',
    'FOR UPDATE',
    'createMany',
    'COMMIT',
  ]);
});

test('chốt số khi kỳ vừa bị khóa sổ chen giữa -> 403 E-dltl-001, không ghi khóa bảng kê', async () => {
  const db = taoDb(khoaSoChenGiua);
  await assert.rejects(
    lockPayrollModule(db, 'p-1', 'OVERTIME' as never, 'u-1'),
    (e: any) => e?.code === 'E-dltl-001' && e.statusCode === 403,
  );
  assert.equal(db.locks.size, 0);
});

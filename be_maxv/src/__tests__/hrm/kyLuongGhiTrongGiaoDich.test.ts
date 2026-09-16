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
import {
  deletePayrollPeriod,
  reopenPayrollPeriod,
} from '../../services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service';
import { bocNgoaiGiaoDich, soatNgoaiGiaoDich } from '../_hoTro/giaoDichGia';

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
  let dangGiaoDich = false;
  let daKiemTruoc = false;

  const db: any = {
    ky,
    locks,
    daGhi,
    sql,
    nhatKy,
    $transaction: async (fn: (tx: unknown) => unknown) => {
      nhatKy.push('BEGIN');
      dangGiaoDich = true;
      try {
        return await fn(db);
      } finally {
        dangGiaoDich = false;
        nhatKy.push('COMMIT');
        soatNgoaiGiaoDich(nhatKy);
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
      // Mở lại / xóa kỳ lương (RVW-721).
      updateMany: async ({ where, data }: any) => {
        if (where.id !== ky.id || !where.status.in.includes(ky.status)) {
          return { count: 0 };
        }
        nhatKy.push('update kỳ');
        Object.assign(ky, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...ky }),
      delete: async () => {
        nhatKy.push('delete kỳ');
        return { ...ky };
      },
    },
    // Xóa kỳ lương đếm khoản thu nhập ngoài lương trước khi xóa (RVW-735); ca kiểm cần thì gán lại `count`.
    otherIncomeRecord: { count: async () => 0 },
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
  // Service nhận bản BỌC, còn `tx` là `db` gốc (RVW-733).
  return bocNgoaiGiaoDich(db, nhatKy, () => dangGiaoDich);
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

test('RVW-721: tháng đã chốt Bảng tính thuế -> mở lại / xóa kỳ lương 409 E-dltl-029, kỳ giữ nguyên', async () => {
  const moLai = taoDb();
  moLai.ky.status = 'LOCKED';
  moLai.locks.add('TAX_SHEET');
  await assert.rejects(
    reopenPayrollPeriod(moLai, 'p-1'),
    (e: any) => e?.code === 'E-dltl-029' && e.statusCode === 409,
  );
  assert.equal(moLai.ky.status, 'LOCKED');

  // Kỳ DRAFT còn khóa TAX_SHEET: dữ liệu cũ, từ trước khi mở lại kỳ bị chặn.
  const xoa = taoDb();
  xoa.locks.add('TAX_SHEET');
  await assert.rejects(
    deletePayrollPeriod(xoa, 'p-1'),
    (e: any) => e?.code === 'E-dltl-029' && e.statusCode === 409,
  );
  assert.ok(!xoa.nhatKy.includes('delete kỳ'));
});

test('RVW-721: mở lại / xóa kỳ lương khóa GHI dòng kỳ trong giao dịch TRƯỚC khi đọc khóa TAX_SHEET và ghi', async () => {
  const ghiLaiDocKhoa = (db: any) => {
    const goc = db.payrollModuleLock.findUnique;
    db.payrollModuleLock.findUnique = async (args: any) => {
      db.nhatKy.push('đọc khóa');
      return goc(args);
    };
    return db;
  };

  const moLai = ghiLaiDocKhoa(taoDb());
  moLai.ky.status = 'LOCKED';
  await reopenPayrollPeriod(moLai, 'p-1');
  assert.deepEqual(moLai.nhatKy, [
    'BEGIN',
    'FOR UPDATE',
    'đọc khóa',
    'update kỳ',
    'COMMIT',
  ]);
  assert.equal(moLai.ky.status, 'DRAFT');

  const xoa = ghiLaiDocKhoa(taoDb());
  await deletePayrollPeriod(xoa, 'p-1');
  assert.deepEqual(xoa.nhatKy, [
    'BEGIN',
    'FOR UPDATE',
    'đọc khóa',
    'delete kỳ',
    'COMMIT',
  ]);
});

test('xóa kỳ lương khi kỳ vừa bị khóa sổ chen giữa -> 403 E-dltl-001, không xóa', async () => {
  const db = taoDb(khoaSoChenGiua);
  await assert.rejects(
    deletePayrollPeriod(db, 'p-1'),
    (e: any) => e?.code === 'E-dltl-001' && e.statusCode === 403,
  );
  assert.ok(!db.nhatKy.includes('delete kỳ'), db.nhatKy.join(' > '));
});

test('RVW-735: kỳ DRAFT còn khoản thu nhập ngoài lương -> xóa kỳ 409 E-dltl-030, không xóa', async () => {
  const db = taoDb();
  db.otherIncomeRecord.count = async ({ where }: any) => {
    db.nhatKy.push('đếm khoản');
    return where.periodId === 'p-1' ? 2 : 0;
  };
  await assert.rejects(
    deletePayrollPeriod(db, 'p-1'),
    (e: any) =>
      e?.code === 'E-dltl-030' &&
      e.statusCode === 409 &&
      /còn 2 khoản/.test(e.message),
  );
  // Đếm DƯỚI khóa dòng kỳ: lượt thêm khoản giữ `FOR SHARE` cùng dòng nên không lọt khoản vừa ghi.
  assert.deepEqual(db.nhatKy, ['BEGIN', 'FOR UPDATE', 'đếm khoản', 'COMMIT']);
});

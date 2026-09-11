import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import errorHandlerPlugin from '../../plugins/errorHandler.plugin';
import { PAYROLL_ERROR_CODES } from '../../constants/hrm/payrollErrors';
import { PAYROLL_MODULE_CODES } from '../../constants/hrm/payrollModules';
import { ForbiddenError } from '../../helpers/errors';
import type { PayrollModuleCode } from '../../generated/tenant';

/**
 * Màn "Chốt kỳ lương" (BR-dltl-030): chốt số từng bảng kê, chốt toàn kỳ, tính lương, lịch sử hoạt động.
 *
 * Engine tính lương (`snapshotPayrollSheet`) được mock: bộ test engine nằm ở `hrmPayrollCalculation`/
 * `hrmPayrollInputData`. Ở đây chỉ kiểm phần của màn chốt kỳ — gọi engine trong transaction, đếm số NV,
 * chặn khi kỳ đã khóa sổ, không đè bảng lương khi trạng thái kỳ vừa đổi.
 */

interface TestUser {
  userId: string;
  donViId: string;
  role: string;
  tokenVersion: number;
}

const OWNER: TestUser = { userId: 'u-owner-1', donViId: 'dv-1', role: 'OWNER', tokenVersion: 1 };
const NHAN_VIEN_HR: TestUser = { userId: 'u-hr-1', donViId: 'dv-1', role: 'OWNER_EMPLOYEE', tokenVersion: 1 };

let dbChoRequestHienTai: unknown;
let xemLuongChoRequestHienTai = true;
let currentTestUser: TestUser = OWNER;

let ghiNhatKyCalls: Array<{ hanhDong: string; userId?: string; donViId?: string; chiTiet?: Record<string, unknown> }> = [];
let tinhCalls: string[] = [];
let ghiDeCalls: string[] = [];
let sysLogRows: Array<Record<string, unknown>> = [];
let sysLogWhere: Record<string, unknown> | undefined;
const SYS_USERS = [
  { id: 'u-owner-1', hoTen: 'Nguyễn Văn Chủ' },
  { id: 'u-hr-1', hoTen: 'Trần Thị Nhân Sự' },
];

let hrmPayrollClosingRoutes: typeof import('../../routes/hrm/du_lieu_tinh_luong/payrollClosing.route').hrmPayrollClosingRoutes;
let hrmPayrollInputsRoutes: typeof import('../../routes/hrm/du_lieu_tinh_luong/payrollInputs.route').hrmPayrollInputsRoutes;
let assertPayrollModuleWritable: typeof import('../../helpers/hrm/payrollPeriodLockGuard').assertPayrollModuleWritable;
let inputs: typeof import('../../services/client/hrm/du_lieu_tinh_luong/payrollInputs.service');

before(async () => {
  mock.module('../../helpers/resolveTenantDb', {
    namedExports: {
      resolveTenantDb: async () => dbChoRequestHienTai,
      resolveTenantCtx: async () => ({
        db: dbChoRequestHienTai,
        dbName: 'test-db',
        maSoThue: '0000000000',
        xemLuong: xemLuongChoRequestHienTai,
      }),
      assertXemLuong: (ctx: { xemLuong: boolean }) => {
        if (!ctx.xemLuong) throw new ForbiddenError('Không có quyền xem dữ liệu lương.');
      },
      currentUserId: (req: { user?: TestUser }) => req.user?.userId,
    },
  });
  mock.module('../../services/shared/syslog.service', {
    namedExports: {
      writeLog: async (input: { hanhDong: string; userId?: string; donViId?: string; chiTiet?: Record<string, unknown> }) => {
        ghiNhatKyCalls.push(input);
      },
    },
  });
  // Control plane giả: "Lịch sử hoạt động" đọc `sys_log` + họ tên `users`.
  mock.module('../../config/db.sys', {
    namedExports: {
      sysPrisma: {
        sysLog: {
          findMany: async (args: { where: Record<string, unknown> }) => {
            sysLogWhere = args.where;
            return sysLogRows;
          },
        },
        user: {
          findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
            SYS_USERS.filter((u) => where.id.in.includes(u.id)),
        },
      },
    },
  });
  mock.module('../../services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service', {
    namedExports: {
      calculatePayrollPreview: async (_db: unknown, periodId: string) => {
        tinhCalls.push(periodId);
        return [{ periodId, ma_nv: 'NV0001' }, { periodId, ma_nv: 'NV0002' }];
      },
      ghiDeBangLuong: async (db: any, periodId: string, lines: unknown[]) => {
        ghiDeCalls.push(periodId);
        await db.payrollSheetLine.deleteMany({ where: { periodId } });
        await db.payrollSheetLine.createMany({ data: lines });
      },
      // `payrollPeriods.service` (nạp gián tiếp qua `chuyenTrangThai`) import tên này.
      snapshotPayrollSheet: async () => [],
    },
  });

  ({ hrmPayrollClosingRoutes } = await import('../../routes/hrm/du_lieu_tinh_luong/payrollClosing.route'));
  ({ hrmPayrollInputsRoutes } = await import('../../routes/hrm/du_lieu_tinh_luong/payrollInputs.route'));
  ({ assertPayrollModuleWritable } = await import('../../helpers/hrm/payrollPeriodLockGuard'));
  inputs = await import('../../services/client/hrm/du_lieu_tinh_luong/payrollInputs.service');
});

beforeEach(() => {
  currentTestUser = OWNER;
  xemLuongChoRequestHienTai = true;
  ghiNhatKyCalls = [];
  tinhCalls = [];
  ghiDeCalls = [];
  sysLogRows = [];
  sysLogWhere = undefined;
});

function loiTrungKhoa() {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
}

function taoDbGia() {
  const periods: any[] = [
    {
      id: 'p-1',
      code: '2026-09',
      name: 'Kỳ lương tháng 9/2026',
      month: 9,
      year: 2026,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-30'),
      status: 'DRAFT',
      lockedAt: null,
      lockedByUserId: null,
    },
  ];
  const locks: any[] = [];
  const sheetLines: any[] = [];

  const khop = (l: any, periodId: string, module?: string) =>
    l.periodId === periodId && (module === undefined || l.module === module);

  const db: any = {
    $transaction: async (fn: any) => fn(db),
    // Guard khóa kỳ trong giao dịch ghi (`khoaKyDeGhiDuLieu`/`khoaKyDeChotSo`):
    // SELECT status FROM "hrm_payroll_periods" WHERE id = $1 FOR SHARE|UPDATE — tham số đầu là id kỳ.
    $queryRaw: async (_sql: TemplateStringsArray, ...values: unknown[]) => {
      const p = periods.find((x) => x.id === values[0]);
      return p ? [{ status: p.status }] : [];
    },
    payrollPeriod: {
      findUnique: async ({ where }: any) => periods.find((p) => p.id === where.id) ?? null,
      updateMany: async ({ where, data }: any) => {
        const row = periods.find(
          (p) => p.id === where.id && (!where.status?.in || where.status.in.includes(p.status)),
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const row = periods.find((p) => p.id === where.id);
        if (!row) throw new Error('Not found');
        return row;
      },
    },
    payrollModuleLock: {
      findUnique: async ({ where }: any) =>
        locks.find((l) => khop(l, where.periodId_module.periodId, where.periodId_module.module)) ?? null,
      findMany: async ({ where }: any) => locks.filter((l) => khop(l, where.periodId)),
      create: async ({ data }: any) => {
        if (locks.some((l) => khop(l, data.periodId, data.module))) throw loiTrungKhoa();
        const row = { id: `lock-${locks.length + 1}`, lockedAt: new Date(), ...data };
        locks.push(row);
        return row;
      },
      // Như Postgres: `skipDuplicates` bỏ qua dòng trùng khóa, kết quả CHỈ gồm các dòng vừa ghi.
      createManyAndReturn: async ({ data, skipDuplicates }: any) => {
        const daGhi: any[] = [];
        for (const d of data) {
          if (locks.some((l) => khop(l, d.periodId, d.module))) {
            if (!skipDuplicates) throw loiTrungKhoa();
            continue;
          }
          const row = { id: `lock-${locks.length + 1}`, lockedAt: new Date(), ...d };
          locks.push(row);
          daGhi.push({ module: row.module });
        }
        return daGhi;
      },
      deleteMany: async ({ where }: any) => {
        const truoc = locks.length;
        for (let i = locks.length - 1; i >= 0; i--) {
          if (khop(locks[i], where.periodId, where.module)) locks.splice(i, 1);
        }
        return { count: truoc - locks.length };
      },
    },
    payrollSheetLine: {
      count: async ({ where }: any) => sheetLines.filter((l) => l.periodId === where.periodId).length,
      deleteMany: async ({ where }: any) => {
        for (let i = sheetLines.length - 1; i >= 0; i--) {
          if (sheetLines[i].periodId === where.periodId) sheetLines.splice(i, 1);
        }
      },
      createMany: async ({ data }: any) => {
        sheetLines.push(...data);
      },
    },
    hrm_nhan_vien: {
      count: async () => 2,
    },
    // `deleteDiligenceRecord` tra bản ghi TRƯỚC khi qua guard để biết kỳ của nó.
    diligenceRecord: {
      findUnique: async ({ where }: any) => ({ id: where.id, periodId: 'p-1' }),
    },
  };

  return { db, periods, locks, sheetLines };
}

async function taoApp() {
  const app = Fastify({ logger: false });
  app.addHook('onRequest', async (req) => {
    (req as unknown as { user: TestUser }).user = currentTestUser;
  });
  await app.register(errorHandlerPlugin);
  await app.register(hrmPayrollClosingRoutes);
  await app.register(hrmPayrollInputsRoutes);
  return app;
}

async function goi(app: Awaited<ReturnType<typeof taoApp>>, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as any });
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

const O_CHAM_CONG = {
  periodId: 'p-1',
  ma_nv: 'NV0001',
  workDate: '2026-09-03',
  attendanceType: 'nghi_phep',
};

test('BR-dltl-030: GET closing — đủ 12 bảng kê đúng thứ tự, kỳ nháp chưa chốt gì, bảng lương 0/2 NV', async () => {
  const { db } = taoDbGia();
  dbChoRequestHienTai = db;
  const app = await taoApp();

  const res = await goi(app, 'GET', '/payroll-periods/p-1/closing');
  assert.equal(res.status, 200);
  const data = res.body.data;
  assert.deepEqual(
    data.modules.map((m: any) => m.module),
    [...PAYROLL_MODULE_CODES],
  );
  assert.equal(data.modules[0].label, 'Chấm công');
  assert.equal(data.totalModules, 12);
  assert.equal(data.lockedModuleCount, 0);
  assert.equal(data.periodLocked, false);
  assert.deepEqual(data.payroll, { calculatedEmployees: 0, totalEmployees: 2 });
  // 8 bảng kê có dữ liệu riêng của kỳ, 4 bảng kê dữ liệu dùng chung.
  assert.equal(data.modules.filter((m: any) => m.periodData).length, 8);
  assert.equal(data.modules.find((m: any) => m.module === 'TAX_DEDUCTION').periodData, false);

  const res404 = await goi(app, 'GET', '/payroll-periods/khong-co/closing');
  assert.equal(res404.status, 404);
  assert.equal(res404.body.code, PAYROLL_ERROR_CODES.E_DLTL_025);
});

test('Chốt số 1 bảng kê: ghi nhật ký + thẻ hiện người chốt; ghi dữ liệu bảng kê đó bị chặn 403 E-dltl-027, bảng kê khác vẫn ghi được', async () => {
  const { db } = taoDbGia();
  dbChoRequestHienTai = db;
  const app = await taoApp();

  const resChot = await goi(app, 'POST', '/payroll-periods/p-1/modules/ATTENDANCE/lock');
  assert.equal(resChot.status, 200);
  assert.equal(resChot.body.data.lockedByUserId, 'u-owner-1');
  assert.ok(
    ghiNhatKyCalls.some(
      (c) =>
        c.hanhDong === 'HRM_PAYROLL_MODULE_LOCKED' &&
        c.donViId === 'dv-1' &&
        c.chiTiet?.periodId === 'p-1' &&
        c.chiTiet?.module === 'ATTENDANCE',
    ),
    'phải ghi nhật ký HRM_PAYROLL_MODULE_LOCKED kèm periodId + module',
  );

  const tongQuan = (await goi(app, 'GET', '/payroll-periods/p-1/closing')).body.data;
  const chamCong = tongQuan.modules.find((m: any) => m.module === 'ATTENDANCE');
  assert.equal(chamCong.locked, true);
  assert.equal(chamCong.lockSource, 'MODULE');
  assert.equal(chamCong.lockedByName, 'Nguyễn Văn Chủ');
  assert.equal(tongQuan.lockedModuleCount, 1);

  // Máy chủ chặn ghi — guard chạy trước mọi truy vấn khác của đường ghi chấm công.
  const resGhi = await goi(app, 'PUT', '/payroll-data/attendance/cell', O_CHAM_CONG);
  assert.equal(resGhi.status, 403);
  assert.equal(resGhi.body.code, PAYROLL_ERROR_CODES.E_DLTL_027);

  // Bảng kê chưa chốt vẫn qua guard.
  await assert.doesNotReject(assertPayrollModuleWritable(db, 'p-1', 'OVERTIME'));
  await assert.rejects(assertPayrollModuleWritable(db, 'p-1', 'ATTENDANCE'), {
    code: PAYROLL_ERROR_CODES.E_DLTL_027,
  });
});

test('Chốt trùng -> 409 E-dltl-028; mở chốt bảng kê đang mở -> 409 E-dltl-028; mã bảng kê lạ -> 400', async () => {
  const { db, locks } = taoDbGia();
  dbChoRequestHienTai = db;
  const app = await taoApp();

  assert.equal((await goi(app, 'POST', '/payroll-periods/p-1/modules/KPI/lock')).status, 200);
  const resTrung = await goi(app, 'POST', '/payroll-periods/p-1/modules/KPI/lock');
  assert.equal(resTrung.status, 409);
  assert.equal(resTrung.body.code, PAYROLL_ERROR_CODES.E_DLTL_028);
  assert.equal(locks.length, 1, 'không được sinh dòng chốt thứ hai');

  const resMoChotDangMo = await goi(app, 'POST', '/payroll-periods/p-1/modules/BONUS/unlock');
  assert.equal(resMoChotDangMo.status, 409);
  assert.equal(resMoChotDangMo.body.code, PAYROLL_ERROR_CODES.E_DLTL_028);

  const resMaLa = await goi(app, 'POST', '/payroll-periods/p-1/modules/KHONG_CO/lock');
  assert.equal(resMaLa.status, 400);
});

test('Mở chốt: nhân viên HR có quyền lương chốt được nhưng KHÔNG mở chốt được (403); chủ tài khoản mở chốt được, ghi nhật ký, bảng kê ghi lại được', async () => {
  const { db } = taoDbGia();
  dbChoRequestHienTai = db;
  const app = await taoApp();

  currentTestUser = NHAN_VIEN_HR;
  assert.equal((await goi(app, 'POST', '/payroll-periods/p-1/modules/OVERTIME/lock')).status, 200);
  const resHrMoChot = await goi(app, 'POST', '/payroll-periods/p-1/modules/OVERTIME/unlock');
  assert.equal(resHrMoChot.status, 403);
  await assert.rejects(assertPayrollModuleWritable(db, 'p-1', 'OVERTIME'), {
    code: PAYROLL_ERROR_CODES.E_DLTL_027,
  });

  currentTestUser = OWNER;
  const resMoChot = await goi(app, 'POST', '/payroll-periods/p-1/modules/OVERTIME/unlock');
  assert.equal(resMoChot.status, 200);
  assert.ok(
    ghiNhatKyCalls.some((c) => c.hanhDong === 'HRM_PAYROLL_MODULE_UNLOCKED' && c.chiTiet?.module === 'OVERTIME'),
  );
  await assert.doesNotReject(assertPayrollModuleWritable(db, 'p-1', 'OVERTIME'));
});

test('Chốt số toàn kỳ: chỉ chốt bảng kê còn mở, 1 dòng nhật ký kèm số lượng; bấm lần 2 không chốt/ghi thêm', async () => {
  const { db, locks } = taoDbGia();
  dbChoRequestHienTai = db;
  const app = await taoApp();

  await goi(app, 'POST', '/payroll-periods/p-1/modules/ATTENDANCE/lock');
  ghiNhatKyCalls = [];

  const res = await goi(app, 'POST', '/payroll-periods/p-1/modules/lock-all');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.lockedModules.length, 11);
  assert.ok(!res.body.data.lockedModules.includes('ATTENDANCE'), 'bảng kê đã chốt từ trước không tính lại');
  assert.equal(locks.length, 12);
  const nhatKy = ghiNhatKyCalls.filter((c) => c.hanhDong === 'HRM_PAYROLL_MODULES_LOCKED_ALL');
  assert.equal(nhatKy.length, 1);
  assert.equal(nhatKy[0]!.chiTiet?.count, 11);

  const tongQuan = (await goi(app, 'GET', '/payroll-periods/p-1/closing')).body.data;
  assert.equal(tongQuan.lockedModuleCount, 12);

  ghiNhatKyCalls = [];
  const resLan2 = await goi(app, 'POST', '/payroll-periods/p-1/modules/lock-all');
  assert.equal(resLan2.status, 200);
  assert.deepEqual(resLan2.body.data.lockedModules, []);
  assert.equal(ghiNhatKyCalls.length, 0);
});

test('Kỳ đã khóa sổ: mọi bảng kê hiện đã chốt theo kỳ; chốt / mở chốt / chốt toàn kỳ / tính lương đều bị chặn 403 E-dltl-001', async () => {
  const { db, periods } = taoDbGia();
  periods[0].status = 'LOCKED';
  periods[0].lockedAt = new Date('2026-09-30T10:00:00Z');
  periods[0].lockedByUserId = 'u-owner-1';
  dbChoRequestHienTai = db;
  const app = await taoApp();

  const tongQuan = (await goi(app, 'GET', '/payroll-periods/p-1/closing')).body.data;
  assert.equal(tongQuan.periodLocked, true);
  assert.equal(tongQuan.lockedModuleCount, 12);
  assert.ok(tongQuan.modules.every((m: any) => m.locked && m.lockSource === 'PERIOD'));

  for (const url of [
    '/payroll-periods/p-1/modules/KPI/lock',
    '/payroll-periods/p-1/modules/KPI/unlock',
    '/payroll-periods/p-1/modules/lock-all',
    '/payroll-periods/p-1/calculate',
  ]) {
    const res = await goi(app, 'POST', url);
    assert.equal(res.status, 403, url);
    assert.equal(res.body.code, PAYROLL_ERROR_CODES.E_DLTL_001, url);
  }
  assert.equal(tinhCalls.length, 0, 'kỳ đã khóa sổ không được chạy engine');
  assert.equal(ghiDeCalls.length, 0, 'kỳ đã khóa sổ không được tính đè bảng lương');
});

test('Tính lương: chạy engine rồi ghi đè trong transaction, trả số NV, ghi nhật ký, "Bảng lương a/b NV" cập nhật; bấm lại thì ghi đè không nhân đôi', async () => {
  const { db } = taoDbGia();
  dbChoRequestHienTai = db;
  const app = await taoApp();

  const res = await goi(app, 'POST', '/payroll-periods/p-1/calculate');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, { calculatedEmployees: 2 });
  assert.deepEqual(tinhCalls, ['p-1']);
  assert.deepEqual(ghiDeCalls, ['p-1']);
  assert.ok(
    ghiNhatKyCalls.some((c) => c.hanhDong === 'HRM_PAYROLL_CALCULATED' && c.chiTiet?.calculatedEmployees === 2),
  );

  await goi(app, 'POST', '/payroll-periods/p-1/calculate');
  const tongQuan = (await goi(app, 'GET', '/payroll-periods/p-1/closing')).body.data;
  assert.deepEqual(tongQuan.payroll, { calculatedEmployees: 2, totalEmployees: 2 });
});

test('Tính lương khi kỳ vừa bị khóa sổ chen giữa (đọc thấy DRAFT, ghi có điều kiện hụt) -> 409 E-dltl-026, không đè bảng lương', async () => {
  const { db, periods } = taoDbGia();
  // Lượt đọc đầu thấy bản chụp DRAFT cũ, nhưng trong DB kỳ đã LOCKED.
  periods[0].status = 'LOCKED';
  db.payrollPeriod.findUnique = async () => ({ ...periods[0], status: 'DRAFT' });
  dbChoRequestHienTai = db;
  const app = await taoApp();

  const res = await goi(app, 'POST', '/payroll-periods/p-1/calculate');
  assert.equal(res.status, 409);
  assert.equal(res.body.code, PAYROLL_ERROR_CODES.E_DLTL_026);
  assert.equal(ghiDeCalls.length, 0, 'không được ghi đè bảng lương vừa chụp lúc khóa sổ');
});

test('RVW-042: cả 10 đường ghi /payroll-data/* chặn đúng bảng kê của mình (E-dltl-027), không chặn nhầm khi bảng kê khác bị chốt', async () => {
  const pId = 'p-1';
  const duongGhi: Array<[string, PayrollModuleCode, (db: any) => Promise<unknown>]> = [
    ['overrideAttendanceCell', 'ATTENDANCE', (db) => inputs.overrideAttendanceCell(db, { periodId: pId } as any)],
    ['applyOvertime', 'OVERTIME', (db) => inputs.applyOvertime(db, { periodId: pId } as any)],
    ['deleteEmployeeOvertime', 'OVERTIME', (db) => inputs.deleteEmployeeOvertime(db, pId, 'NV0001')],
    ['applyKpi', 'KPI', (db) => inputs.applyKpi(db, { periodId: pId } as any)],
    ['applyBonus', 'BONUS', (db) => inputs.applyBonus(db, { periodId: pId } as any)],
    ['applyPiecework', 'PIECEWORK', (db) => inputs.applyPiecework(db, { periodId: pId } as any)],
    ['applyCommission', 'COMMISSION', (db) => inputs.applyCommission(db, { periodId: pId } as any)],
    ['recordDiligenceViolation', 'DILIGENCE', (db) => inputs.recordDiligenceViolation(db, { periodId: pId } as any)],
    ['deleteDiligenceRecord', 'DILIGENCE', (db) => inputs.deleteDiligenceRecord(db, 'dr-1')],
    ['applyAdjustments', 'ADJUSTMENT', (db) => inputs.applyAdjustments(db, { periodId: pId } as any)],
  ];

  for (const [ten, bangKe, ghi] of duongGhi) {
    // Chỉ chốt đúng bảng kê của đường ghi -> phải bị chặn.
    const chiBangKeNay = taoDbGia();
    chiBangKeNay.locks.push({ id: 'l-1', periodId: pId, module: bangKe, lockedByUserId: 'u', lockedAt: new Date() });
    await assert.rejects(ghi(chiBangKeNay.db), { code: PAYROLL_ERROR_CODES.E_DLTL_027 }, `${ten} phải bị chặn khi ${bangKe} đã chốt`);

    // Chốt MỌI bảng kê khác -> guard phải cho qua (lỗi phía sau, nếu có, do DB giả thiếu bảng — không phải 027).
    const cacBangKeKhac = taoDbGia();
    for (const khac of PAYROLL_MODULE_CODES.filter((c) => c !== bangKe)) {
      cacBangKeKhac.locks.push({ id: `l-${khac}`, periodId: pId, module: khac, lockedByUserId: 'u', lockedAt: new Date() });
    }
    await ghi(cacBangKeKhac.db).then(
      () => undefined,
      (err: { code?: string }) => {
        assert.notEqual(err?.code, PAYROLL_ERROR_CODES.E_DLTL_027, `${ten} bị chặn nhầm bởi bảng kê khác`);
      },
    );
  }
});

test('Lịch sử hoạt động: lọc đúng công ty + kỳ, câu mô tả tiếng Việt, tên người làm; kỳ lạ -> 404; thiếu quyền lương -> 403', async () => {
  const { db } = taoDbGia();
  dbChoRequestHienTai = db;
  const app = await taoApp();

  sysLogRows = [
    {
      id: 'log-3',
      hanhDong: 'HRM_PAYROLL_MODULE_LOCKED',
      userId: 'u-hr-1',
      chiTiet: { periodId: 'p-1', module: 'ATTENDANCE' },
      createdAt: new Date('2026-09-10T09:38:11Z'),
    },
    {
      id: 'log-2',
      hanhDong: 'HRM_PAYROLL_CALCULATED',
      userId: 'u-owner-1',
      chiTiet: { periodId: 'p-1', calculatedEmployees: 0 },
      createdAt: new Date('2026-09-10T09:27:57Z'),
    },
    {
      id: 'log-1',
      hanhDong: 'HRM_PAYROLL_PERIOD_REOPENED',
      userId: null,
      chiTiet: { periodId: 'p-1', reason: 'Bổ sung ngày công cho nhân viên mới vào' },
      createdAt: new Date('2026-09-09T09:00:00Z'),
    },
  ];

  const res = await goi(app, 'GET', '/payroll-periods/p-1/activities');
  assert.equal(res.status, 200);
  assert.equal(sysLogWhere?.donViId, 'dv-1');
  assert.deepEqual(sysLogWhere?.chiTiet, { path: ['periodId'], equals: 'p-1' });

  const [chot, tinh, moLai] = res.body.data;
  assert.equal(chot.type, 'LOCK');
  assert.equal(chot.description, 'Chốt số liệu Chấm công');
  assert.equal(chot.userName, 'Trần Thị Nhân Sự');
  assert.equal(tinh.type, 'EDIT');
  assert.equal(tinh.description, 'Đã tính lương cho 0 nhân viên');
  assert.equal(moLai.type, 'UNLOCK');
  assert.equal(moLai.description, 'Mở lại kỳ lương — lý do: Bổ sung ngày công cho nhân viên mới vào');
  assert.equal(moLai.userName, 'Hệ thống');

  assert.equal((await goi(app, 'GET', '/payroll-periods/khong-co/activities')).status, 404);

  xemLuongChoRequestHienTai = false;
  assert.equal((await goi(app, 'GET', '/payroll-periods/p-1/activities')).status, 403);
  assert.equal((await goi(app, 'GET', '/payroll-periods/p-1/closing')).status, 403);
});

test('RVW-042: 4 route ghi của màn Chốt kỳ lương đều chặn 403 khi thiếu quyền lương — không ghi khóa, không chạy engine', async () => {
  const { db, locks } = taoDbGia();
  dbChoRequestHienTai = db;
  const app = await taoApp();
  xemLuongChoRequestHienTai = false;

  for (const url of [
    '/payroll-periods/p-1/modules/KPI/lock',
    '/payroll-periods/p-1/modules/KPI/unlock',
    '/payroll-periods/p-1/modules/lock-all',
    '/payroll-periods/p-1/calculate',
  ]) {
    assert.equal((await goi(app, 'POST', url)).status, 403, url);
  }
  assert.equal(locks.length, 0);
  assert.equal(tinhCalls.length, 0);
  assert.equal(ghiNhatKyCalls.length, 0);
});

import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import errorHandlerPlugin from '../../plugins/errorHandler.plugin';
import { Prisma } from '../../generated/tenant';
import {
  tinhThueLuyTien,
  resolveStandardWorkDays,
} from '../../services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service';
import { getDiligenceData } from '../../services/client/hrm/du_lieu_tinh_luong/payrollInputs.service';
import { PAYROLL_ERROR_CODES } from '../../constants/hrm/payrollErrors';
import { ForbiddenError } from '../../helpers/errors';

let hrmPayrollPeriodsRoutes: typeof import('../../routes/hrm/du_lieu_tinh_luong/payrollPeriods.route').hrmPayrollPeriodsRoutes;
let hrmPayrollCatalogsRoutes: typeof import('../../routes/hrm/du_lieu_tinh_luong/catalogs.route').hrmPayrollCatalogsRoutes;
let hrmPayrollInputsRoutes: typeof import('../../routes/hrm/du_lieu_tinh_luong/payrollInputs.route').hrmPayrollInputsRoutes;
let hrmPayrollCalculationRoutes: typeof import('../../routes/hrm/du_lieu_tinh_luong/payrollCalculation.route').hrmPayrollCalculationRoutes;

let dbChoRequestHienTai: unknown;

// A-01 (review-findings.md 2026-09-09): cờ quyền xem lương mô phỏng cho `resolveTenantCtx` mock —
// mọi test mặc định `true`, các test kiểm chứng guard tự đặt `false` rồi phải trả lại `true`.
let xemLuongChoRequestHienTai = true;

interface TestUser {
  userId: string;
  donViId: string;
  role: string;
  tokenVersion: number;
}

// Bug#8 (RVW-002 + BUG-dltl-003/004): người dùng giả lập cho `req.user` — thay thế hoàn toàn
// việc test cũ chạy "ẩn danh" (không có req.user) mà RVW-010 đã cảnh báo.
let currentTestUser: TestUser = {
  userId: 'u-owner-1',
  donViId: 'dv-1',
  role: 'OWNER',
  tokenVersion: 1,
};

// Bug#8: spy cho `writeLog` (services/shared/syslog.service) — thay cho việc gọi thật sysPrisma
// (control plane), vừa tránh side-effect ghi DB thật trong test, vừa cho phép assert đúng
// hành động + nội dung đã ghi.
let ghiNhatKyLuongCalls: Array<{
  hanhDong: string;
  userId?: string;
  donViId?: string;
  chiTiet?: Record<string, unknown>;
}> = [];

before(async () => {
  mock.module('../../helpers/resolveTenantDb', {
    namedExports: {
      resolveTenantDb: async () => dbChoRequestHienTai,
      // A-01: mock `resolveTenantCtx` + `assertXemLuong` — 4 controller giờ gọi
      // `dbCoQuyenLuongPayroll` (helpers/payrollAccessGuard.ts) thay vì `resolveTenantDb` trơn.
      resolveTenantCtx: async () => ({
        db: dbChoRequestHienTai,
        dbName: 'test-db',
        maSoThue: '0000000000',
        xemLuong: xemLuongChoRequestHienTai,
      }),
      assertXemLuong: (ctx: { xemLuong: boolean }) => {
        if (!ctx.xemLuong) {
          throw new ForbiddenError('Không có quyền xem dữ liệu lương.');
        }
      },
      currentUserId: (req: { user?: TestUser }) => req.user?.userId,
    },
  });
  // Bug#8: không gọi `sysPrisma` thật (control plane) trong test — ghi vào mảng spy.
  mock.module('../../services/shared/syslog.service', {
    namedExports: {
      writeLog: async (input: { hanhDong: string; userId?: string; donViId?: string; chiTiet?: Record<string, unknown> }) => {
        ghiNhatKyLuongCalls.push(input);
      },
    },
  });
  ({ hrmPayrollPeriodsRoutes } = await import('../../routes/hrm/du_lieu_tinh_luong/payrollPeriods.route'));
  ({ hrmPayrollCatalogsRoutes } = await import('../../routes/hrm/du_lieu_tinh_luong/catalogs.route'));
  ({ hrmPayrollInputsRoutes } = await import('../../routes/hrm/du_lieu_tinh_luong/payrollInputs.route'));
  ({ hrmPayrollCalculationRoutes } = await import('../../routes/hrm/du_lieu_tinh_luong/payrollCalculation.route'));
});

const DEFAULT_GENERAL_SETTING = {
  id: 'DEFAULT',
  standardWorkingDaysMethod: 'FIXED_26',
  saturdayPolicy: 'HALF_DAY',
  sundayPolicy: 'OFF',
  standardHoursPerDay: new Prisma.Decimal(8.0),
  maxOtHoursPerMonth: 40,
  warningOtHoursPerYear: 200,
  maxOtHoursPerYear: 300,
  insuranceEmployeeSocial: new Prisma.Decimal(8.0),
  insuranceEmployeeHealth: new Prisma.Decimal(1.5),
  insuranceEmployeeUnemployment: new Prisma.Decimal(1.0),
  insuranceCompanySocial: new Prisma.Decimal(17.5),
  insuranceCompanyHealth: new Prisma.Decimal(3.0),
  insuranceCompanyUnemployment: new Prisma.Decimal(1.0),
  unionFeeEmployeeRate: new Prisma.Decimal(1.0),
  unionFeeMaxAmount: new Prisma.Decimal(234000),
  unionFeeCompanyRate: new Prisma.Decimal(2.0),
  personalDeduction: new Prisma.Decimal(11000000),
  dependentDeduction: new Prisma.Decimal(4400000),
  otRateWeekdayDay: new Prisma.Decimal(150),
  otRateWeekdayNight: new Prisma.Decimal(200),
  otRateWeekendDay: new Prisma.Decimal(200),
  otRateWeekendNight: new Prisma.Decimal(270),
  otRateHolidayDay: new Prisma.Decimal(300),
  otRateHolidayNight: new Prisma.Decimal(390),
};

const DEFAULT_EMPLOYEES: any[] = [
  {
    ma_nv: 'NV0001',
    ho_ten: 'Nguyễn Văn An',
    chuc_vu: 'Lập trình viên',
    ma_pb: 'PB01',
    cong_doan: true,
    status: '1',
    da_xoa: false,
    hop_dong: [
      {
        id: 'hd-1',
        ma_nv: 'NV0001',
        so_hd: 'HD01',
        loai_hd: 'xac_dinh',
        kieu_luong: 'GROSS',
        luong_chinh: new Prisma.Decimal(15000000),
        luong_bhxh: new Prisma.Decimal(15000000),
        ngay_bat_dau: new Date('2026-01-01'),
        ngay_ket_thuc: null,
        trich_bhxh: true,
        tinh_tncn: true,
      },
    ],
    nguoi_phu_thuoc: [],
  },
];

/**
 * Mô phỏng đối chiếu `include.hop_dong.where` mà Prisma thật sẽ áp dụng ở tầng DB — mock cũ bỏ
 * qua hoàn toàn (luôn trả nguyên mảng `hop_dong`), khiến A-02 không thể viết test được. Chỉ cần
 * đúng 2 nhánh mà `payrollCalculation.service.ts` dùng: `ngay_bat_dau.lte` và `OR` của
 * `ngay_ket_thuc`.
 */
function matchesHopDongWhere(hd: any, where: any): boolean {
  if (!where) return true;
  if (where.ngay_bat_dau?.lte && hd.ngay_bat_dau.getTime() > where.ngay_bat_dau.lte.getTime()) {
    return false;
  }
  if (where.OR) {
    const orMatch = where.OR.some((cond: any) => {
      if (Object.prototype.hasOwnProperty.call(cond, 'ngay_ket_thuc')) {
        if (cond.ngay_ket_thuc === null) return hd.ngay_ket_thuc === null;
        if (cond.ngay_ket_thuc?.gte) {
          return !!hd.ngay_ket_thuc && hd.ngay_ket_thuc.getTime() >= cond.ngay_ket_thuc.gte.getTime();
        }
      }
      return false;
    });
    if (!orMatch) return false;
  }
  return true;
}

interface MockTenantDbOptions {
  employees?: any[];
  generalSetting?: Record<string, unknown> | null;
  holidays?: any[];
}

function createMockTenantDb(options: MockTenantDbOptions = {}) {
  const periods: any[] = [];
  const kpiItems: any[] = [];
  const products: any[] = [];
  const diligenceTypes: any[] = [];
  const adjustmentItems: any[] = [];

  const attendances: any[] = [];
  const overtimes: any[] = [];
  const kpis: any[] = [];
  const bonuses: any[] = [];
  const pieceworks: any[] = [];
  const commissions: any[] = [];
  const diligences: any[] = [];
  const adjustments: any[] = [];
  const sheetLines: any[] = [];

  const employees: any[] = options.employees ?? DEFAULT_EMPLOYEES;
  const holidaysData: any[] = options.holidays ?? [];

  const employeeSalaries: any[] = [
    {
      id: 'es-1',
      ma_nv: 'NV0001',
      totalAmount: new Prisma.Decimal(15000000),
      status: 'APPROVED',
      items: [
        {
          id: 'esi-1',
          amount: new Prisma.Decimal(1000000),
          salaryItem: { category: 'ATTENDANCE_ALLOWANCE' },
        },
      ],
    },
  ];

  const generalSettingRow =
    options.generalSetting === null
      ? null
      : { ...DEFAULT_GENERAL_SETTING, ...(options.generalSetting ?? {}) };

  const db: any = {
    $transaction: async (fn: any) => fn(db),
    generalSetting: {
      findFirst: async () => generalSettingRow,
    },
    holiday: {
      findMany: async () => holidaysData,
    },
    hrm_nhan_vien: {
      findMany: async (args?: any) => {
        let list = [...employees];
        if (args?.where?.ma_nv?.in) {
          list = list.filter((e) => args.where.ma_nv.in.includes(e.ma_nv));
        }
        if (args?.where?.ma_pb) {
          list = list.filter((e) => e.ma_pb === args.where.ma_pb);
        }
        const hopDongInclude = args?.include?.hop_dong;
        if (hopDongInclude) {
          list = list.map((e) => {
            let hd = (e.hop_dong ?? []).filter((row: any) => matchesHopDongWhere(row, hopDongInclude.where));
            hd = [...hd].sort((a: any, b: any) => b.ngay_bat_dau.getTime() - a.ngay_bat_dau.getTime());
            if (hopDongInclude.take) hd = hd.slice(0, hopDongInclude.take);
            return { ...e, hop_dong: hd };
          });
        }
        return list;
      },
      findUnique: async ({ where }: any) => employees.find((e) => e.ma_nv === where.ma_nv) ?? null,
    },
    hrm_phong_ban: {
      findMany: async () => [{ ma_pb: 'PB01', ten_pb: 'Phòng Kỹ thuật' }],
    },
    employeeSalary: {
      findMany: async () => employeeSalaries,
    },
    salaryItem: {
      findMany: async () => [
        { id: 'uuid-bonus-1', code: 'TH01', name: 'Thưởng KPI', defaultRate: null },
        { id: 'uuid-comm-1', code: 'HH01', name: 'Hoa hồng bán hàng', defaultRate: new Prisma.Decimal(5) },
      ],
    },
    payrollPeriod: {
      findMany: async () => periods,
      findUnique: async ({ where }: any) => {
        if (where.id) return periods.find((p) => p.id === where.id) ?? null;
        if (where.code) return periods.find((p) => p.code === where.code) ?? null;
        return null;
      },
      create: async ({ data }: any) => {
        const row = { id: `period-${periods.length + 1}`, ...data, createdAt: new Date(), updatedAt: new Date() };
        periods.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = periods.find((p) => p.id === where.id);
        if (!row) throw new Error('Not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      delete: async ({ where }: any) => {
        const idx = periods.findIndex((p) => p.id === where.id);
        if (idx >= 0) return periods.splice(idx, 1)[0];
        throw new Error('Not found');
      },
    },
    kpiItem: {
      findMany: async () => kpiItems,
      findUnique: async ({ where }: any) => {
        if (where.id) return kpiItems.find((k) => k.id === where.id) ?? null;
        if (where.code) return kpiItems.find((k) => k.code === where.code) ?? null;
        return null;
      },
      create: async ({ data }: any) => {
        const row = { id: `kpi-${kpiItems.length + 1}`, ...data };
        kpiItems.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = kpiItems.find((k) => k.id === where.id);
        if (!row) throw new Error('Not found');
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }: any) => {
        const idx = kpiItems.findIndex((k) => k.id === where.id);
        if (idx >= 0) return kpiItems.splice(idx, 1)[0];
        throw new Error('Not found');
      },
    },
    pieceworkProduct: {
      findMany: async () => products,
      findUnique: async ({ where }: any) => {
        if (where.id) return products.find((p) => p.id === where.id) ?? null;
        if (where.code) return products.find((p) => p.code === where.code) ?? null;
        return null;
      },
      create: async ({ data }: any) => {
        const row = { id: `sp-${products.length + 1}`, ...data };
        products.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = products.find((p) => p.id === where.id);
        if (!row) throw new Error('Not found');
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }: any) => {
        const idx = products.findIndex((p) => p.id === where.id);
        if (idx >= 0) return products.splice(idx, 1)[0];
        throw new Error('Not found');
      },
    },
    diligenceViolationType: {
      findMany: async () => diligenceTypes,
      findUnique: async ({ where }: any) => {
        if (where.id) return diligenceTypes.find((d) => d.id === where.id) ?? null;
        if (where.code) return diligenceTypes.find((d) => d.code === where.code) ?? null;
        return null;
      },
      create: async ({ data }: any) => {
        const row = { id: `cc-${diligenceTypes.length + 1}`, ...data };
        diligenceTypes.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = diligenceTypes.find((d) => d.id === where.id);
        if (!row) throw new Error('Not found');
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }: any) => {
        const idx = diligenceTypes.findIndex((d) => d.id === where.id);
        if (idx >= 0) return diligenceTypes.splice(idx, 1)[0];
        throw new Error('Not found');
      },
    },
    salaryAdjustmentItem: {
      findMany: async () => adjustmentItems,
      findUnique: async ({ where }: any) => {
        if (where.id) return adjustmentItems.find((a) => a.id === where.id) ?? null;
        if (where.code) return adjustmentItems.find((a) => a.code === where.code) ?? null;
        return null;
      },
      create: async ({ data }: any) => {
        const row = { id: `bt-${adjustmentItems.length + 1}`, ...data };
        adjustmentItems.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = adjustmentItems.find((a) => a.id === where.id);
        if (!row) throw new Error('Not found');
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }: any) => {
        const idx = adjustmentItems.findIndex((a) => a.id === where.id);
        if (idx >= 0) return adjustmentItems.splice(idx, 1)[0];
        throw new Error('Not found');
      },
    },
    attendanceRecord: {
      findMany: async (args?: any) => {
        if (args?.where?.periodId) {
          return attendances.filter((a) => a.periodId === args.where.periodId);
        }
        return attendances;
      },
      // A-03/RVW-001: upsert thật (tra `where`) thay vì luôn `push(create)` — mock cũ khiến
      // khóa duy nhất (periodId, ma_nv, workDate) không được mô phỏng.
      upsert: async ({ where, create, update }: any) => {
        const key = where.periodId_ma_nv_workDate;
        const idx = attendances.findIndex(
          (a) =>
            a.periodId === key.periodId &&
            a.ma_nv === key.ma_nv &&
            a.workDate.getTime() === key.workDate.getTime(),
        );
        if (idx >= 0) {
          attendances[idx] = { ...attendances[idx], ...update };
          return attendances[idx];
        }
        const row = { id: `att-${attendances.length + 1}`, ...create };
        attendances.push(row);
        return row;
      },
    },
    overtimeRecord: {
      findMany: async () => overtimes,
      deleteMany: async () => {},
      createMany: async ({ data }: any) => {
        overtimes.push(...data);
      },
    },
    kpiRecord: {
      findMany: async () => kpis,
      count: async () => kpis.length,
      deleteMany: async () => {},
      createMany: async ({ data }: any) => {
        kpis.push(...data);
      },
    },
    bonusRecord: {
      findMany: async () => bonuses,
      deleteMany: async () => {},
      createMany: async ({ data }: any) => {
        bonuses.push(...data);
      },
    },
    pieceworkRecord: {
      findMany: async () => pieceworks,
      count: async () => pieceworks.length,
      deleteMany: async () => {},
      createMany: async ({ data }: any) => {
        pieceworks.push(...data);
      },
    },
    commissionRecord: {
      findMany: async () => commissions,
      deleteMany: async () => {},
      createMany: async ({ data }: any) => {
        commissions.push(...data);
      },
    },
    diligenceRecord: {
      findMany: async (args?: any) => {
        let list = diligences;
        if (args?.where?.periodId) {
          list = list.filter((d: any) => d.periodId === args.where.periodId);
        }
        if (args?.include?.violationType) {
          list = list.map((d: any) => ({
            ...d,
            violationType: diligenceTypes.find((t) => t.id === d.violationTypeId) ?? null,
          }));
        }
        return list;
      },
      findUnique: async () => null,
      count: async () => diligences.length,
      create: async ({ data }: any) => {
        const row = { id: `dr-${diligences.length + 1}`, ...data };
        diligences.push(row);
        return row;
      },
      delete: async ({ where }: any) => {
        const idx = diligences.findIndex((d) => d.id === where.id);
        if (idx >= 0) return diligences.splice(idx, 1)[0];
        throw new Error('Not found');
      },
    },
    salaryAdjustmentRecord: {
      findMany: async () => adjustments,
      count: async () => adjustments.length,
      deleteMany: async () => {},
      createMany: async ({ data }: any) => {
        adjustments.push(...data);
      },
    },
    payrollSheetLine: {
      findMany: async () => sheetLines,
      deleteMany: async () => {},
      createMany: async ({ data }: any) => {
        sheetLines.push(...data);
      },
    },
  };

  return { db, periods, kpiItems, products, diligenceTypes, adjustmentItems, attendances, diligences };
}

async function buildTestApp() {
  const app = Fastify({ logger: false });
  // Bug#8/RVW-002: giả lập `req.user` như sau `authenticate` thật (payload {userId, donViId,
  // role, tokenVersion} — types/fastify.d.ts) — trước đây test chạy "ẩn danh" nên không bắt được
  // lỗi `(req.user as any)?.sub`.
  app.addHook('onRequest', async (req) => {
    (req as unknown as { user: TestUser }).user = currentTestUser;
  });
  await app.register(errorHandlerPlugin);
  await app.register(hrmPayrollPeriodsRoutes);
  await app.register(hrmPayrollCatalogsRoutes);
  await app.register(hrmPayrollInputsRoutes);
  await app.register(hrmPayrollCalculationRoutes);
  return app;
}

function createPeriodRow(db: any, overrides: Partial<{ code: string; name: string; month: number; year: number; startDate: Date; endDate: Date }> = {}) {
  return db.payrollPeriod.create({
    data: {
      code: overrides.code ?? '2026-09',
      name: overrides.name ?? 'Kỳ lương tháng 09/2026',
      month: overrides.month ?? 9,
      year: overrides.year ?? 2026,
      startDate: overrides.startDate ?? new Date('2026-09-01'),
      endDate: overrides.endDate ?? new Date('2026-09-30'),
      status: 'DRAFT',
    },
  });
}

test('Vòng đời Kỳ lương (PayrollPeriod Lifecycle) và Khóa sổ Snapshot', async () => {
  currentTestUser = { userId: 'u-owner-1', donViId: 'dv-1', role: 'OWNER', tokenVersion: 1 };
  xemLuongChoRequestHienTai = true;
  ghiNhatKyLuongCalls = [];

  const { db, periods } = createMockTenantDb();
  dbChoRequestHienTai = db;
  const app = await buildTestApp();

  // 1. Tạo kỳ lương tháng 08/2026
  const resCreate = await app.inject({
    method: 'POST',
    url: '/payroll-periods',
    payload: { month: 8, year: 2026, name: 'Kỳ lương tháng 08/2026' },
  });
  assert.equal(resCreate.statusCode, 201);
  const period = JSON.parse(resCreate.body).data;
  assert.equal(period.code, '2026-08');
  assert.equal(period.status, 'DRAFT');

  // 2. Tạo trùng code báo 409 Conflict
  const resDup = await app.inject({
    method: 'POST',
    url: '/payroll-periods',
    payload: { month: 8, year: 2026, name: 'Trùng tháng' },
  });
  assert.equal(resDup.statusCode, 409);

  // 3. Submit kỳ sang PENDING_REVIEW
  const resSubmit = await app.inject({
    method: 'POST',
    url: `/payroll-periods/${period.id}/submit`,
  });
  assert.equal(resSubmit.statusCode, 200);
  assert.equal(periods[0].status, 'PENDING_REVIEW');

  // 4. Khóa sổ kỳ lương -> LOCKED
  const resLock = await app.inject({
    method: 'POST',
    url: `/payroll-periods/${period.id}/lock`,
  });
  assert.equal(resLock.statusCode, 200);
  assert.equal(periods[0].status, 'LOCKED');

  // RVW-002: `lockedByUserId` phải là userId THẬT của người khóa sổ, không còn `null` vĩnh viễn
  // (trước đây đọc `(req.user as any)?.sub` — claim không tồn tại trong JWT payload dự án).
  const lockedPeriod = JSON.parse(resLock.body).data;
  assert.equal(lockedPeriod.lockedByUserId, 'u-owner-1');

  // Bug#8 (BUG-dltl-004): audit log phải được ghi qua `writeLog` khi khóa sổ.
  assert.ok(
    ghiNhatKyLuongCalls.some((c) => c.hanhDong === 'HRM_PAYROLL_PERIOD_LOCKED' && c.userId === 'u-owner-1'),
    'phải ghi audit log HRM_PAYROLL_PERIOD_LOCKED',
  );

  // 5. Thử ghi dữ liệu khi kỳ đã LOCKED -> Bị chặn 403 (E-dltl-001)
  const resBlocked = await app.inject({
    method: 'POST',
    url: '/payroll-data/overtime/apply',
    payload: {
      periodId: period.id,
      scope: 'toan_cong_ty',
      items: [{ otType: 'ngay_thuong_ngay', hours: 4 }],
    },
  });
  assert.equal(resBlocked.statusCode, 403);
  const blockErr = JSON.parse(resBlocked.body);
  assert.equal(blockErr.code, PAYROLL_ERROR_CODES.E_DLTL_001);

  // 6. Reopen kỳ lương: Lý do < 20 ký tự bị từ chối
  const resReopenShort = await app.inject({
    method: 'POST',
    url: `/payroll-periods/${period.id}/reopen`,
    payload: { reason: 'Lý do ngắn' },
  });
  assert.equal(resReopenShort.statusCode, 400);

  // 7. Reopen kỳ lương: Lý do >= 20 ký tự thành công chuyển về DRAFT
  const resReopenOk = await app.inject({
    method: 'POST',
    url: `/payroll-periods/${period.id}/reopen`,
    payload: { reason: 'Cần mở lại kỳ lương để bổ sung ngày công cho nhân viên mới' },
  });
  assert.equal(resReopenOk.statusCode, 200);
  assert.equal(periods[0].status, 'DRAFT');
});

test('Bất biến Tài chính: Thuế lũy tiến 7 bậc và Chặn sàn Chuyên cần (gọi thật payrollCalculation/payrollInputs service)', async () => {
  // Test 1: Biểu thuế lũy tiến — gọi trực tiếp hàm sản xuất thật (KHÔNG đụng trong đợt sửa này).
  assert.equal(tinhThueLuyTien(0), 0);
  assert.equal(tinhThueLuyTien(4_000_000), 200_000); // Bậc 1: 5%
  assert.equal(tinhThueLuyTien(8_000_000), 550_000); // Bậc 2: 250k + 300k
  assert.equal(tinhThueLuyTien(15_000_000), 1_500_000); // Bậc 3

  // Test 2: Bất biến Chặn sàn Chuyên cần (BR-dltl-016) — SỬA test giả (review-findings.md
  // RVW-010/BUG-dltl-006): trước đây test tự tính lại công thức bằng biến cục bộ rồi assert với
  // chính nó (xóa `Math.max(0,...)` thật thì test vẫn PASS). Giờ gọi ĐÚNG `getDiligenceData`
  // (payrollInputs.service.ts) — nếu code sản xuất bị xóa/hỏng, test này sẽ FAIL thật.
  const { db, diligenceTypes } = createMockTenantDb();
  const period = await createPeriodRow(db);

  // Đơn giá chuyên cần = 1.000.000 (đã có sẵn trong mock: EmployeeSalary khoản ATTENDANCE_ALLOWANCE)
  const violationType = await db.diligenceViolationType.create({
    data: { code: 'CC01', name: 'Đi trễ trên 15 phút', deductionMethod: 'theo_lan', penaltyRate: new Prisma.Decimal(500000), status: 'ACTIVE' },
  });
  assert.equal(diligenceTypes.length, 1);

  // 3 lần vi phạm theo_lan x 500.000 = 1.500.000 > đơn giá 1.000.000
  for (const day of ['2026-09-02', '2026-09-09', '2026-09-16']) {
    await db.diligenceRecord.create({
      data: {
        periodId: period.id,
        ma_nv: 'NV0001',
        violationTypeId: violationType.id,
        violationDate: new Date(day),
        violationHours: null,
        note: null,
      },
    });
  }

  const rows = await getDiligenceData(db, { periodId: period.id });
  const row = rows.find((r) => r.ma_nv === 'NV0001');
  assert.ok(row, 'phải có dòng chuyên cần cho NV0001');
  assert.equal(row!.donGia, 1_000_000);
  assert.equal(row!.soViPham, 3);
  assert.equal(row!.tongTru, 1_000_000); // min(1.500.000, 1.000.000)
  assert.equal(row!.thanhTien, 0); // Không bao giờ bị âm
});

test('Quản lý Danh mục Chuyên biệt (Catalogs CRUD)', async () => {
  currentTestUser = { userId: 'u-owner-1', donViId: 'dv-1', role: 'OWNER', tokenVersion: 1 };
  xemLuongChoRequestHienTai = true;

  const { db } = createMockTenantDb();
  dbChoRequestHienTai = db;
  const app = await buildTestApp();

  // 1. Tạo chỉ tiêu KPI
  const resKpi = await app.inject({
    method: 'POST',
    url: '/payroll-catalogs/kpi-items',
    payload: { name: 'Doanh số bán hàng', unit: 'VND', defaultWeight: 50 },
  });
  assert.equal(resKpi.statusCode, 201);
  const kpi = JSON.parse(resKpi.body).data;
  assert.equal(kpi.code, 'KPI01');

  // 2. Tạo sản phẩm khoán
  const resSp = await app.inject({
    method: 'POST',
    url: '/payroll-catalogs/products',
    payload: { name: 'Áo sơ mi xuất khẩu', unit: 'Cái', unitPrice: 25000 },
  });
  assert.equal(resSp.statusCode, 201);
  const sp = JSON.parse(resSp.body).data;
  assert.equal(sp.code, 'SP01');

  // 3. Tạo lỗi chuyên cần
  const resCc = await app.inject({
    method: 'POST',
    url: '/payroll-catalogs/diligence-types',
    payload: { name: 'Đi trễ trên 15 phút', deductionMethod: 'theo_lan', penaltyRate: 50000 },
  });
  assert.equal(resCc.statusCode, 201);
  const cc = JSON.parse(resCc.body).data;
  assert.equal(cc.code, 'CC01');

  // 4. Tạo khoản bù trừ
  const resBt = await app.inject({
    method: 'POST',
    url: '/payroll-catalogs/adjustment-items',
    payload: { name: 'Tạm ứng giữa tháng', direction: 'tru' },
  });
  assert.equal(resBt.statusCode, 201);
  const bt = JSON.parse(resBt.body).data;
  assert.equal(bt.code, 'BT01');
});

test('BUG-dltl-002: resolveStandardWorkDays đọc GeneralSetting.standardWorkingDaysMethod, không còn hardcode 26', () => {
  const period = { year: 2026, month: 9 };
  assert.equal(resolveStandardWorkDays(period, null, []), 26); // chưa có cấu hình -> mặc định FIXED_26
  assert.equal(
    resolveStandardWorkDays(period, { ...DEFAULT_GENERAL_SETTING, standardWorkingDaysMethod: 'FIXED_24' } as any, []),
    24,
  );
  assert.equal(
    resolveStandardWorkDays(period, { ...DEFAULT_GENERAL_SETTING, standardWorkingDaysMethod: 'FIXED_26' } as any, []),
    26,
  );
});

test('RVW-001: mô hình chấm công delta — 1 bản ghi nghỉ không lương duy nhất KHÔNG được xóa gần hết lương cơ bản', async () => {
  currentTestUser = { userId: 'u-owner-1', donViId: 'dv-1', role: 'OWNER', tokenVersion: 1 };
  xemLuongChoRequestHienTai = true;

  const { db } = createMockTenantDb();
  dbChoRequestHienTai = db;
  const app = await buildTestApp();

  const period = await createPeriodRow(db, { code: '2026-09', month: 9, year: 2026 });

  // Trước khi sửa: engine coi tập AttendanceRecord là lịch công CẢ THÁNG, nên 1 bản ghi
  // khong_luong (0h) làm actualWorkDays sập về ~0 thay vì standardWorkDays - 1 (= 25/26).
  const resCell = await app.inject({
    method: 'PUT',
    url: '/payroll-data/attendance/cell',
    payload: { periodId: period.id, ma_nv: 'NV0001', workDate: '2026-09-05', attendanceType: 'khong_luong' },
  });
  assert.equal(resCell.statusCode, 200);

  const resCalc = await app.inject({ method: 'GET', url: `/payroll/calculate?periodId=${period.id}` });
  assert.equal(resCalc.statusCode, 200);
  const row = JSON.parse(resCalc.body).data.find((r: any) => r.ma_nv === 'NV0001');

  assert.equal(row.standardWorkDays, 26);
  assert.equal(row.actualWorkDays, 25); // ĐÚNG: 26 - 1 (không còn là 0 như bug cũ)
  assert.equal(row.proratedWorkSalary, Math.round((15_000_000 * 25) / 26)); // 14.423.077
});

test('A-03: attendanceType quyết định workDayValue — actualHours client gửi sai bị bỏ qua với loại nghỉ cố định', async () => {
  currentTestUser = { userId: 'u-owner-1', donViId: 'dv-1', role: 'OWNER', tokenVersion: 1 };
  xemLuongChoRequestHienTai = true;

  const { db } = createMockTenantDb();
  dbChoRequestHienTai = db;
  const app = await buildTestApp();

  const period = await createPeriodRow(db);

  // Client gửi nhầm actualHours=8 cho "nghỉ không lương" (trước đây sẽ ra workDayValue=1.0,
  // tức hưởng nguyên ngày công — sai). Sau khi sửa: attendanceType quyết định, actualHours bị bỏ qua.
  const resKhongLuong = await app.inject({
    method: 'PUT',
    url: '/payroll-data/attendance/cell',
    payload: { periodId: period.id, ma_nv: 'NV0001', workDate: '2026-09-05', attendanceType: 'khong_luong', actualHours: 8 },
  });
  assert.equal(resKhongLuong.statusCode, 200);
  const khongLuongRow = JSON.parse(resKhongLuong.body).data;
  assert.equal(khongLuongRow.workDayValue, 0);
  assert.equal(khongLuongRow.actualHours, 0);

  // Client gửi nhầm actualHours=0 cho "nghỉ phép năm hưởng lương" — vẫn phải hưởng đủ 1.0 công.
  const resNghiPhep = await app.inject({
    method: 'PUT',
    url: '/payroll-data/attendance/cell',
    payload: { periodId: period.id, ma_nv: 'NV0001', workDate: '2026-09-06', attendanceType: 'nghi_phep', actualHours: 0 },
  });
  assert.equal(resNghiPhep.statusCode, 200);
  const nghiPhepRow = JSON.parse(resNghiPhep.body).data;
  assert.equal(nghiPhepRow.workDayValue, 1);
  assert.equal(nghiPhepRow.actualHours, 8);
});

test('BUG-dltl-007: actualHours vượt giờ chuẩn/ngày bị CHẶN 400 E-dltl-005 thay vì tràn workDayValue', async () => {
  currentTestUser = { userId: 'u-owner-1', donViId: 'dv-1', role: 'OWNER', tokenVersion: 1 };
  xemLuongChoRequestHienTai = true;

  const { db } = createMockTenantDb();
  dbChoRequestHienTai = db;
  const app = await buildTestApp();

  const period = await createPeriodRow(db);

  // Trước khi sửa: actualHours=24 -> workDayValue=3.0 (tràn, không có validate).
  const res = await app.inject({
    method: 'PUT',
    url: '/payroll-data/attendance/cell',
    payload: { periodId: period.id, ma_nv: 'NV0001', workDate: '2026-09-05', attendanceType: 'lam_viec', actualHours: 24 },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).code, PAYROLL_ERROR_CODES.E_DLTL_005);
});

test('A-02: chọn hợp đồng CÓ HIỆU LỰC TRONG KỲ, không lấy hợp đồng ký trước cho tương lai', async () => {
  currentTestUser = { userId: 'u-owner-1', donViId: 'dv-1', role: 'OWNER', tokenVersion: 1 };
  xemLuongChoRequestHienTai = true;

  const { db } = createMockTenantDb({
    employees: [
      {
        ma_nv: 'NV0002',
        ho_ten: 'Trần Thị Bình',
        chuc_vu: 'Kế toán',
        ma_pb: 'PB01',
        cong_doan: false,
        status: '1',
        da_xoa: false,
        hop_dong: [
          {
            id: 'hd-a',
            ma_nv: 'NV0002',
            so_hd: 'HD-A',
            loai_hd: 'xac_dinh',
            kieu_luong: 'GROSS',
            luong_chinh: new Prisma.Decimal(15000000),
            luong_bhxh: new Prisma.Decimal(15000000),
            ngay_bat_dau: new Date('2026-01-01'),
            ngay_ket_thuc: null,
            trich_bhxh: false,
            tinh_tncn: false,
          },
          {
            // Ký trước cho tháng 10 kèm tăng lương — CHƯA có hiệu lực trong kỳ 2026-09.
            id: 'hd-b',
            ma_nv: 'NV0002',
            so_hd: 'HD-B',
            loai_hd: 'xac_dinh',
            kieu_luong: 'GROSS',
            luong_chinh: new Prisma.Decimal(25000000),
            luong_bhxh: new Prisma.Decimal(25000000),
            ngay_bat_dau: new Date('2026-10-01'),
            ngay_ket_thuc: null,
            trich_bhxh: false,
            tinh_tncn: false,
          },
        ],
        nguoi_phu_thuoc: [],
      },
    ],
  });
  dbChoRequestHienTai = db;
  const app = await buildTestApp();

  const period = await createPeriodRow(db, { code: '2026-09', month: 9, year: 2026 });

  const res = await app.inject({ method: 'GET', url: `/payroll/calculate?periodId=${period.id}` });
  assert.equal(res.statusCode, 200);
  const row = JSON.parse(res.body).data.find((r: any) => r.ma_nv === 'NV0002');
  assert.ok(row, 'phải có dòng cho NV0002');
  // Trước khi sửa A-02 (`orderBy ngay_bat_dau desc take 1`, không lọc kỳ): sẽ chọn nhầm hd-b
  // (25 triệu). Sau khi sửa: chỉ hd-a còn hiệu lực trong kỳ 2026-09.
  assert.equal(row.baseSalaryMonthly, 15000000);
});

test('A-01: chặn 403 khi thiếu quyền xemLuong trên các controller payroll (payrollCalculation + payrollPeriods)', async () => {
  currentTestUser = { userId: 'u-emp-1', donViId: 'dv-1', role: 'OWNER_EMPLOYEE', tokenVersion: 1 };

  const { db } = createMockTenantDb();
  dbChoRequestHienTai = db;
  const app = await buildTestApp();

  const period = await createPeriodRow(db);

  xemLuongChoRequestHienTai = false;
  try {
    const resCalc = await app.inject({ method: 'GET', url: `/payroll/calculate?periodId=${period.id}` });
    assert.equal(resCalc.statusCode, 403);

    const resList = await app.inject({ method: 'GET', url: '/payroll-periods' });
    assert.equal(resList.statusCode, 403);
  } finally {
    xemLuongChoRequestHienTai = true; // KHÔNG để rò rỉ sang các test sau
  }
});

test('BUG-dltl-002: tỷ lệ BHXH/BHYT/BHTN và đoàn phí đọc từ GeneralSetting, không còn hardcode 0.105/0.215/1%/234000/2%', async () => {
  currentTestUser = { userId: 'u-owner-1', donViId: 'dv-1', role: 'OWNER', tokenVersion: 1 };
  xemLuongChoRequestHienTai = true;

  const { db } = createMockTenantDb({
    generalSetting: {
      standardWorkingDaysMethod: 'FIXED_24', // mặc định cũ hardcode 26 -> giờ phải ra 24
      insuranceEmployeeSocial: new Prisma.Decimal(10), // mặc định 8 -> đổi thành 10
      unionFeeEmployeeRate: new Prisma.Decimal(2), // mặc định 1% -> đổi thành 2%
      unionFeeMaxAmount: new Prisma.Decimal(100000), // mặc định 234.000 -> hạ trần
    },
  });
  dbChoRequestHienTai = db;
  const app = await buildTestApp();

  const period = await createPeriodRow(db);

  const res = await app.inject({ method: 'GET', url: `/payroll/calculate?periodId=${period.id}` });
  assert.equal(res.statusCode, 200);
  const row = JSON.parse(res.body).data.find((r: any) => r.ma_nv === 'NV0001');

  assert.equal(row.standardWorkDays, 24);
  assert.equal(row.actualWorkDays, 24); // chưa chấm công gì -> đủ ngày công chuẩn ĐÃ CẤU HÌNH
  assert.equal(row.proratedWorkSalary, 15000000); // không delta -> đủ lương thỏa thuận

  // employeeInsuranceRate = (10 + 1.5 + 1)/100 = 0.125 ; insuranceSalaryBase = 15.000.000
  assert.equal(row.employeeInsuranceDeduction, Math.round(15_000_000 * 0.125));
  // unionFeeEmployeeRate 2% -> round(15tr*0.02)=300.000, nhưng trần cấu hình hạ còn 100.000
  assert.equal(row.employeeUnionFee, 100_000);
});

test('Bug#8: reopen/lock chặn role không phải ADMIN/OWNER (assertAdminOrOwner), và ghi audit log qua writeLog khi thành công', async () => {
  const { db, periods } = createMockTenantDb();
  dbChoRequestHienTai = db;
  xemLuongChoRequestHienTai = true;
  ghiNhatKyLuongCalls = [];
  const app = await buildTestApp();

  currentTestUser = { userId: 'u-owner-2', donViId: 'dv-1', role: 'OWNER', tokenVersion: 1 };
  const resCreate = await app.inject({
    method: 'POST',
    url: '/payroll-periods',
    payload: { month: 11, year: 2026, name: 'Kỳ lương tháng 11/2026' },
  });
  assert.equal(resCreate.statusCode, 201);
  const period = JSON.parse(resCreate.body).data;

  // OWNER_EMPLOYEE KHÔNG được khóa sổ (BR-dltl-002/ADR-dltl-05 — trước đây bất kỳ ai qua
  // requireModule('hrm') cũng khóa sổ được).
  currentTestUser = { userId: 'u-emp-2', donViId: 'dv-1', role: 'OWNER_EMPLOYEE', tokenVersion: 1 };
  const resLockDenied = await app.inject({ method: 'POST', url: `/payroll-periods/${period.id}/lock` });
  assert.equal(resLockDenied.statusCode, 403);
  assert.equal(periods[0].status, 'DRAFT'); // vẫn chưa bị khóa

  // OWNER khóa sổ thành công + audit log
  currentTestUser = { userId: 'u-owner-2', donViId: 'dv-1', role: 'OWNER', tokenVersion: 1 };
  const resLockOk = await app.inject({ method: 'POST', url: `/payroll-periods/${period.id}/lock` });
  assert.equal(resLockOk.statusCode, 200);
  assert.equal(JSON.parse(resLockOk.body).data.lockedByUserId, 'u-owner-2');
  assert.ok(ghiNhatKyLuongCalls.some((c) => c.hanhDong === 'HRM_PAYROLL_PERIOD_LOCKED'));

  // OWNER_EMPLOYEE KHÔNG được mở lại kỳ
  currentTestUser = { userId: 'u-emp-2', donViId: 'dv-1', role: 'OWNER_EMPLOYEE', tokenVersion: 1 };
  const resReopenDenied = await app.inject({
    method: 'POST',
    url: `/payroll-periods/${period.id}/reopen`,
    payload: { reason: 'Nhân viên thường không được phép mở lại kỳ lương đã khóa' },
  });
  assert.equal(resReopenDenied.statusCode, 403);
  assert.equal(periods[0].status, 'LOCKED'); // vẫn chưa mở lại

  // OWNER mở lại kỳ thành công + audit log ghi ĐÚNG lý do (BUG-dltl-004: trước đây validate rồi vứt)
  currentTestUser = { userId: 'u-owner-2', donViId: 'dv-1', role: 'OWNER', tokenVersion: 1 };
  const reason = 'Cần mở lại kỳ lương để bổ sung dữ liệu chấm công còn thiếu của phòng kế toán';
  const resReopenOk = await app.inject({
    method: 'POST',
    url: `/payroll-periods/${period.id}/reopen`,
    payload: { reason },
  });
  assert.equal(resReopenOk.statusCode, 200);
  assert.equal(periods[0].status, 'DRAFT');
  const reopenLog = ghiNhatKyLuongCalls.find((c) => c.hanhDong === 'HRM_PAYROLL_PERIOD_REOPENED');
  assert.ok(reopenLog, 'phải ghi audit log HRM_PAYROLL_PERIOD_REOPENED khi reopen thành công');
  assert.equal(reopenLog!.chiTiet?.reason, reason);
  assert.equal(reopenLog!.userId, 'u-owner-2');
});

import type { AttendanceType, OvertimeType, PrismaClient } from '../../../../generated/tenant';
import { NotFoundError } from '../../../../helpers/errors';
import { PayrollError } from '../../../../helpers/hrm/payrollErrors';
import { PAYROLL_ERROR_CODES } from '../../../../constants/hrm/payrollErrors';
import { HttpStatus } from '../../../../constants/httpStatus';
import {
  assertPayrollPeriodWritable,
  getPayrollPeriodOrThrow,
} from '../../../../helpers/hrm/payrollPeriodLockGuard';
import {
  buildActiveEmployeeWhere,
  groupByMaNv,
} from '../../../../utils/du_lieu_tinh_luong/payrollAggregation.util';
import type {
  ApplyAdjustmentsInput,
  ApplyBonusInput,
  ApplyCommissionInput,
  ApplyKpiInput,
  ApplyOvertimeInput,
  ApplyPieceworkInput,
  AttendanceMatrixQuery,
  CellOverrideInput,
  ListModuleDataQuery,
  RecordDiligenceInput,
} from '../../../../validators/hrm/du_lieu_tinh_luong/inputs.validator';

/**
 * Phân giải danh sách nhân viên theo 3 phạm vi áp dụng (ThanhLocKyLuong)
 */
export async function resolveTargetEmployees(
  db: PrismaClient,
  scope: 'toan_cong_ty' | 'phong_ban' | 'nhan_vien',
  ma_pb?: string,
  employeeIds?: string[],
) {
  if (scope === 'toan_cong_ty') {
    return db.hrm_nhan_vien.findMany({
      where: { status: '1', da_xoa: false },
      select: { ma_nv: true, ho_ten: true, ma_pb: true },
      orderBy: { ma_nv: 'asc' },
    });
  }

  if (scope === 'phong_ban') {
    if (!ma_pb) {
      throw new PayrollError(
        PAYROLL_ERROR_CODES.E_DLTL_003,
        'Chưa chọn phòng ban khi áp dụng theo phạm vi phòng ban.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return db.hrm_nhan_vien.findMany({
      where: { status: '1', da_xoa: false, ma_pb },
      select: { ma_nv: true, ho_ten: true, ma_pb: true },
      orderBy: { ma_nv: 'asc' },
    });
  }

  // scope === 'nhan_vien'
  if (!employeeIds || employeeIds.length === 0) {
    throw new PayrollError(
      PAYROLL_ERROR_CODES.E_DLTL_004,
      'Danh sách nhân viên áp dụng không được để trống.',
      HttpStatus.BAD_REQUEST,
    );
  }

  return db.hrm_nhan_vien.findMany({
    where: { ma_nv: { in: employeeIds }, status: '1', da_xoa: false },
    select: { ma_nv: true, ho_ten: true, ma_pb: true },
    orderBy: { ma_nv: 'asc' },
  });
}

/**
 * Thay toàn bộ bản ghi phát sinh của các nhân viên trong `employeeCodes` cho kỳ `periodId`: xóa
 * cũ rồi ghi lại theo dữ liệu hiện tại — dùng chung cho 6 khối "Áp dụng theo phạm vi" (tăng ca/
 * KPI/thưởng/sản phẩm/hoa hồng/ứng-bù trừ). Gộp N cặp deleteMany+createMany (1 cặp/nhân viên)
 * thành đúng 1 cặp truy vấn cho cả phạm vi.
 */
async function replaceScopedRecords<Row>(
  delegate: { deleteMany: (args: any) => Promise<unknown>; createMany: (args: any) => Promise<unknown> },
  periodId: string,
  employeeCodes: string[],
  buildRowsForEmployee: (ma_nv: string) => Row[],
) {
  await delegate.deleteMany({ where: { periodId, ma_nv: { in: employeeCodes } } });

  const data = employeeCodes.flatMap(buildRowsForEmployee);
  if (data.length > 0) {
    await delegate.createMany({ data });
  }
}

// ==========================================
// 1. CHẤM CÔNG (ATTENDANCE)
// ==========================================
export async function getAttendanceMatrix(db: PrismaClient, query: AttendanceMatrixQuery) {
  const period = await getPayrollPeriodOrThrow(db, query.periodId);

  const whereNv = buildActiveEmployeeWhere(query);

  const [employees, records, settings, holidays] = await Promise.all([
    db.hrm_nhan_vien.findMany({
      where: whereNv,
      select: { ma_nv: true, ho_ten: true, ma_pb: true },
      orderBy: { ma_nv: 'asc' },
    }),
    db.attendanceRecord.findMany({
      where: { periodId: query.periodId },
    }),
    db.generalSetting.findFirst(),
    db.holiday.findMany(),
  ]);

  return {
    period,
    settings,
    holidays,
    employees,
    records,
  };
}

/**
 * Chính sách quy đổi loại ngày công (`AttendanceType`) sang hệ số công (`workDayValue`) —
 * A-03 (review-findings.md 2026-09-09, data-model-du-lieu-tinh-luong.md Mục 6.2): trước đây
 * engine tính lương chỉ cộng `workDayValue`, KHÔNG BAO GIỜ đọc `attendanceType`, nên đánh dấu
 * "nghỉ không lương" mà quên tự tay hạ `actualHours` thì vẫn hưởng nguyên ngày công. Bảng dưới
 * bám đúng ý nghĩa gốc của enum `AttendanceType` (docblock `prisma/tenant/schema.prisma`,
 * `BA_ANALYSIS_SPEC.md` Mục 2): `lam_viec`/`nua_ngay` là 2 loại DUY NHẤT cho client tự khai
 * `actualHours` (làm việc thật, số giờ biến thiên); 6 loại còn lại có hệ số CỐ ĐỊNH theo luật/
 * chính sách — `cong_tac`/`nghi_phep`/`nghi_le` hưởng 100% lương (1.0 công) bất kể giờ khai báo,
 * `om` hưởng chế độ BHXH (0 công phía doanh nghiệp), `khong_luong`/`khac` = 0 công.
 */
const ATTENDANCE_FIXED_VALUE: Partial<Record<AttendanceType, number>> = {
  cong_tac: 1,
  nghi_phep: 1,
  nghi_le: 1,
  om: 0,
  khong_luong: 0,
  khac: 0,
};

/** `attendanceType` có cho phép client tự khai `actualHours` hay không — xem bảng trên. */
function isHourBasedAttendanceType(type: AttendanceType): boolean {
  return type === 'lam_viec' || type === 'nua_ngay';
}

export async function overrideAttendanceCell(db: PrismaClient, input: CellOverrideInput) {
  await assertPayrollPeriodWritable(db, input.periodId);

  const workDate = new Date(input.workDate);
  const attendanceType = input.attendanceType as AttendanceType;

  // BUG-dltl-002 (Cấu hình hardcode): đọc "giờ chuẩn/ngày" từ GeneralSetting thay vì hardcode
  // 8.0 — con số này cũng là TRẦN chặn workDayValue (BUG-dltl-007).
  const setting = await db.generalSetting.findFirst();
  const standardHoursPerDay = setting ? Number(setting.standardHoursPerDay) : 8.0;

  let actualHours: number;
  let workDayValue: number;

  if (isHourBasedAttendanceType(attendanceType)) {
    const defaultHours = attendanceType === 'nua_ngay' ? standardHoursPerDay / 2 : standardHoursPerDay;
    actualHours = input.actualHours ?? defaultHours;

    // BUG-dltl-007: `actualHours=24` trước đây cho ra `workDayValue=3.0` (tràn, âm thầm).
    // Ưu tiên VALIDATE rõ ràng thay vì cắt ngầm — trả 400 E-dltl-005 đúng thông điệp đã công bố
    // "không vượt quá số giờ chuẩn trong ngày" (trước đây Zod chỉ chặn khoảng vật lý 0-24h).
    if (actualHours < 0 || actualHours > standardHoursPerDay) {
      throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_005, undefined, HttpStatus.BAD_REQUEST);
    }
    workDayValue = Number((actualHours / standardHoursPerDay).toFixed(2));
  } else {
    // A-03: 6 loại còn lại có hệ số CỐ ĐỊNH — bỏ qua `actualHours` client gửi lên (nếu có).
    const fixedValue = ATTENDANCE_FIXED_VALUE[attendanceType] ?? 0;
    workDayValue = fixedValue;
    actualHours = Number((fixedValue * standardHoursPerDay).toFixed(2));
  }

  return db.attendanceRecord.upsert({
    where: {
      periodId_ma_nv_workDate: {
        periodId: input.periodId,
        ma_nv: input.ma_nv,
        workDate,
      },
    },
    create: {
      periodId: input.periodId,
      ma_nv: input.ma_nv,
      workDate,
      attendanceType,
      actualHours,
      workDayValue,
      note: input.note,
    },
    update: {
      attendanceType,
      actualHours,
      workDayValue,
      note: input.note,
    },
  });
}

// ==========================================
// 2. TĂNG CA (OVERTIME)
// ==========================================
const DEFAULT_OT_RATES: Record<string, number> = {
  ngay_thuong_ngay: 150.0,
  ngay_thuong_dem: 200.0,
  chu_nhat_ngay: 200.0,
  chu_nhat_dem: 270.0,
  ngay_le_ngay: 300.0,
  ngay_le_dem: 390.0,
};

export async function getOvertimeData(db: PrismaClient, query: ListModuleDataQuery) {
  const [employees, records, setting] = await Promise.all([
    db.hrm_nhan_vien.findMany({
      where: buildActiveEmployeeWhere(query),
      select: { ma_nv: true, ho_ten: true, ma_pb: true },
      orderBy: { ma_nv: 'asc' },
    }),
    db.overtimeRecord.findMany({
      where: { periodId: query.periodId },
    }),
    db.generalSetting.findFirst(),
  ]);

  // BUG-dltl-002: ngưỡng cảnh báo OT/tháng đọc từ GeneralSetting.maxOtHoursPerMonth thay vì
  // hardcode 40 — đổi "Cấu hình mặc định" phải phản ánh ngay ở cờ cảnh báo màn Tăng ca.
  const maxOtHoursPerMonth = setting ? setting.maxOtHoursPerMonth : 40;

  const recordMap = groupByMaNv(records);

  return employees.map((emp) => {
    const empRecords = recordMap.get(emp.ma_nv) ?? [];
    const totalHours = empRecords.reduce((sum, r) => sum + Number(r.hours), 0);
    const convertedHours = empRecords.reduce((sum, r) => sum + Number(r.convertedHours), 0);
    return {
      ma_nv: emp.ma_nv,
      ho_ten: emp.ho_ten,
      ma_pb: emp.ma_pb,
      records: empRecords,
      totalHours,
      convertedHours,
      isWarningMonth: totalHours > maxOtHoursPerMonth,
    };
  });
}

export async function applyOvertime(db: PrismaClient, input: ApplyOvertimeInput) {
  await assertPayrollPeriodWritable(db, input.periodId);

  // Kiểm tra trùng loại tăng ca (E-dltl-006)
  const seenTypes = new Set<string>();
  for (const item of input.items) {
    if (seenTypes.has(item.otType)) {
      throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_006, undefined, HttpStatus.BAD_REQUEST);
    }
    seenTypes.add(item.otType);
  }

  const [targetEmployees, setting] = await Promise.all([
    resolveTargetEmployees(db, input.scope, input.ma_pb, input.employeeIds),
    db.generalSetting.findFirst(),
  ]);

  const rates: Record<string, number> = {
    ngay_thuong_ngay: setting ? Number(setting.otRateWeekdayDay) : DEFAULT_OT_RATES.ngay_thuong_ngay,
    ngay_thuong_dem: setting ? Number(setting.otRateWeekdayNight) : DEFAULT_OT_RATES.ngay_thuong_dem,
    chu_nhat_ngay: setting ? Number(setting.otRateWeekendDay) : DEFAULT_OT_RATES.chu_nhat_ngay,
    chu_nhat_dem: setting ? Number(setting.otRateWeekendNight) : DEFAULT_OT_RATES.chu_nhat_dem,
    ngay_le_ngay: setting ? Number(setting.otRateHolidayDay) : DEFAULT_OT_RATES.ngay_le_ngay,
    ngay_le_dem: setting ? Number(setting.otRateHolidayNight) : DEFAULT_OT_RATES.ngay_le_dem,
  };

  return db.$transaction(async (tx) => {
    await replaceScopedRecords(
      tx.overtimeRecord,
      input.periodId,
      targetEmployees.map((e) => e.ma_nv),
      (ma_nv) =>
        input.items.map((it) => {
          const rate = rates[it.otType] ?? 150.0;
          const converted = Number(((it.hours * rate) / 100).toFixed(2));
          return {
            periodId: input.periodId,
            ma_nv,
            otType: it.otType as OvertimeType,
            hours: it.hours,
            ratePercent: rate,
            convertedHours: converted,
            note: it.note ?? null,
          };
        }),
    );
    return { appliedCount: targetEmployees.length };
  });
}

export async function deleteEmployeeOvertime(db: PrismaClient, periodId: string, ma_nv: string) {
  await assertPayrollPeriodWritable(db, periodId);
  return db.overtimeRecord.deleteMany({
    where: { periodId, ma_nv },
  });
}

// ==========================================
// 3. KPI
// ==========================================
export async function getKpiData(db: PrismaClient, query: ListModuleDataQuery) {
  const [employees, records] = await Promise.all([
    db.hrm_nhan_vien.findMany({
      where: buildActiveEmployeeWhere(query),
      select: { ma_nv: true, ho_ten: true, ma_pb: true },
      orderBy: { ma_nv: 'asc' },
    }),
    db.kpiRecord.findMany({
      where: { periodId: query.periodId },
      include: { kpiItem: true },
    }),
  ]);

  const recordMap = groupByMaNv(records);

  return employees.map((emp) => {
    const empRecords = recordMap.get(emp.ma_nv) ?? [];
    let weightedSum = 0;
    let totalWeight = 0;
    for (const r of empRecords) {
      weightedSum += Number(r.completionRate) * r.weight;
      totalWeight += r.weight;
    }
    const avgScore = totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : null;

    return {
      ma_nv: emp.ma_nv,
      ho_ten: emp.ho_ten,
      ma_pb: emp.ma_pb,
      records: empRecords,
      avgScore,
      totalKpiItems: empRecords.length,
    };
  });
}

export async function applyKpi(db: PrismaClient, input: ApplyKpiInput) {
  await assertPayrollPeriodWritable(db, input.periodId);

  // Kiểm tra trùng chỉ tiêu KPI (E-dltl-009)
  const seenKpis = new Set<string>();
  let totalWeight = 0;
  for (const item of input.items) {
    if (seenKpis.has(item.kpiItemId)) {
      throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_009, undefined, HttpStatus.BAD_REQUEST);
    }
    seenKpis.add(item.kpiItemId);
    totalWeight += item.weight;
  }

  if (input.items.length > 0 && totalWeight <= 0) {
    throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_010, undefined, HttpStatus.BAD_REQUEST);
  }

  const targetEmployees = await resolveTargetEmployees(db, input.scope, input.ma_pb, input.employeeIds);

  return db.$transaction(async (tx) => {
    await replaceScopedRecords(
      tx.kpiRecord,
      input.periodId,
      targetEmployees.map((e) => e.ma_nv),
      (ma_nv) =>
        input.items.map((it) => {
          const completionRate = Number(((it.actualValue / it.targetValue) * 100).toFixed(2));
          return {
            periodId: input.periodId,
            ma_nv,
            kpiItemId: it.kpiItemId,
            weight: it.weight,
            targetValue: it.targetValue,
            actualValue: it.actualValue,
            completionRate,
            note: it.note ?? null,
          };
        }),
    );
    return { appliedCount: targetEmployees.length };
  });
}

// ==========================================
// 4. THƯỞNG (BONUS)
// ==========================================
export async function getBonusData(db: PrismaClient, query: ListModuleDataQuery) {
  const [employees, records] = await Promise.all([
    db.hrm_nhan_vien.findMany({
      where: buildActiveEmployeeWhere(query),
      select: { ma_nv: true, ho_ten: true, ma_pb: true },
      orderBy: { ma_nv: 'asc' },
    }),
    db.bonusRecord.findMany({
      where: { periodId: query.periodId },
      include: { salaryItem: true },
    }),
  ]);

  const recordMap = groupByMaNv(records);

  return employees.map((emp) => {
    const empRecords = recordMap.get(emp.ma_nv) ?? [];
    const totalAmount = empRecords.reduce((sum, r) => sum + Number(r.amount), 0);
    return {
      ma_nv: emp.ma_nv,
      ho_ten: emp.ho_ten,
      ma_pb: emp.ma_pb,
      records: empRecords,
      totalAmount,
    };
  });
}

export async function applyBonus(db: PrismaClient, input: ApplyBonusInput) {
  await assertPayrollPeriodWritable(db, input.periodId);

  // Kiểm tra trùng khoản thưởng (E-dltl-011)
  const seenItems = new Set<string>();
  for (const item of input.items) {
    if (seenItems.has(item.salaryItemId)) {
      throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_011, undefined, HttpStatus.BAD_REQUEST);
    }
    seenItems.add(item.salaryItemId);
  }

  const targetEmployees = await resolveTargetEmployees(db, input.scope, input.ma_pb, input.employeeIds);

  return db.$transaction(async (tx) => {
    await replaceScopedRecords(
      tx.bonusRecord,
      input.periodId,
      targetEmployees.map((e) => e.ma_nv),
      (ma_nv) =>
        input.items.map((it) => ({
          periodId: input.periodId,
          ma_nv,
          salaryItemId: it.salaryItemId,
          amount: it.amount,
          note: it.note ?? null,
        })),
    );
    return { appliedCount: targetEmployees.length };
  });
}

// ==========================================
// 5. LƯƠNG SẢN PHẨM (PIECEWORK)
// ==========================================
export async function getPieceworkData(db: PrismaClient, query: ListModuleDataQuery) {
  const [employees, records] = await Promise.all([
    db.hrm_nhan_vien.findMany({
      where: buildActiveEmployeeWhere(query),
      select: { ma_nv: true, ho_ten: true, ma_pb: true },
      orderBy: { ma_nv: 'asc' },
    }),
    db.pieceworkRecord.findMany({
      where: { periodId: query.periodId },
      include: { product: true },
    }),
  ]);

  const recordMap = groupByMaNv(records);

  return employees.map((emp) => {
    const empRecords = recordMap.get(emp.ma_nv) ?? [];
    const totalAmount = empRecords.reduce((sum, r) => sum + Number(r.totalAmount), 0);
    return {
      ma_nv: emp.ma_nv,
      ho_ten: emp.ho_ten,
      ma_pb: emp.ma_pb,
      records: empRecords,
      totalAmount,
    };
  });
}

export async function applyPiecework(db: PrismaClient, input: ApplyPieceworkInput) {
  await assertPayrollPeriodWritable(db, input.periodId);

  // Kiểm tra trùng sản phẩm (E-dltl-014)
  const seenProducts = new Set<string>();
  for (const item of input.items) {
    if (seenProducts.has(item.productId)) {
      throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_014, undefined, HttpStatus.BAD_REQUEST);
    }
    seenProducts.add(item.productId);
  }

  // Đọc danh mục để lấy đơn giá mặc định nếu không truyền
  const [targetEmployees, productCatalog] = await Promise.all([
    resolveTargetEmployees(db, input.scope, input.ma_pb, input.employeeIds),
    db.pieceworkProduct.findMany({
      where: { id: { in: input.items.map((i) => i.productId) } },
    }),
  ]);
  const catalogPriceMap = new Map(productCatalog.map((p) => [p.id, Number(p.unitPrice)]));

  return db.$transaction(async (tx) => {
    await replaceScopedRecords(
      tx.pieceworkRecord,
      input.periodId,
      targetEmployees.map((e) => e.ma_nv),
      (ma_nv) =>
        input.items.map((it) => {
          const unitPrice = it.unitPrice != null ? it.unitPrice : (catalogPriceMap.get(it.productId) ?? 0);
          const totalAmount = Math.round(unitPrice * it.quantity);
          return {
            periodId: input.periodId,
            ma_nv,
            productId: it.productId,
            unitPrice,
            quantity: it.quantity,
            totalAmount,
            note: it.note ?? null,
          };
        }),
    );
    return { appliedCount: targetEmployees.length };
  });
}

// ==========================================
// 6. LƯƠNG PHẦN TRĂM (COMMISSION)
// ==========================================
export async function getCommissionData(db: PrismaClient, query: ListModuleDataQuery) {
  const [employees, records] = await Promise.all([
    db.hrm_nhan_vien.findMany({
      where: buildActiveEmployeeWhere(query),
      select: { ma_nv: true, ho_ten: true, ma_pb: true },
      orderBy: { ma_nv: 'asc' },
    }),
    db.commissionRecord.findMany({
      where: { periodId: query.periodId },
      include: { salaryItem: true },
    }),
  ]);

  const recordMap = groupByMaNv(records);

  return employees.map((emp) => {
    const empRecords = recordMap.get(emp.ma_nv) ?? [];
    const totalAmount = empRecords.reduce((sum, r) => sum + Number(r.totalAmount), 0);
    return {
      ma_nv: emp.ma_nv,
      ho_ten: emp.ho_ten,
      ma_pb: emp.ma_pb,
      records: empRecords,
      totalAmount,
    };
  });
}

export async function applyCommission(db: PrismaClient, input: ApplyCommissionInput) {
  await assertPayrollPeriodWritable(db, input.periodId);

  // Kiểm tra trùng khoản hoa hồng (E-dltl-016)
  const seenItems = new Set<string>();
  for (const item of input.items) {
    if (seenItems.has(item.salaryItemId)) {
      throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_016, undefined, HttpStatus.BAD_REQUEST);
    }
    seenItems.add(item.salaryItemId);
  }

  const [targetEmployees, salaryItems] = await Promise.all([
    resolveTargetEmployees(db, input.scope, input.ma_pb, input.employeeIds),
    db.salaryItem.findMany({
      where: { id: { in: input.items.map((i) => i.salaryItemId) } },
    }),
  ]);
  const defaultRateMap = new Map(salaryItems.map((s) => [s.id, s.defaultRate ? Number(s.defaultRate) : 0]));

  return db.$transaction(async (tx) => {
    await replaceScopedRecords(
      tx.commissionRecord,
      input.periodId,
      targetEmployees.map((e) => e.ma_nv),
      (ma_nv) =>
        input.items.map((it) => {
          const rate = it.commissionRate != null ? it.commissionRate : (defaultRateMap.get(it.salaryItemId) ?? 0);
          const totalAmount = Math.round((it.baseAmount * rate) / 100);
          return {
            periodId: input.periodId,
            ma_nv,
            salaryItemId: it.salaryItemId,
            baseAmount: it.baseAmount,
            commissionRate: rate,
            totalAmount,
            note: it.note ?? null,
          };
        }),
    );
    return { appliedCount: targetEmployees.length };
  });
}

// ==========================================
// 7. LƯƠNG CHUYÊN CẦN (DILIGENCE)
// ==========================================
export async function getDiligenceData(db: PrismaClient, query: ListModuleDataQuery) {
  const [employees, records, employeeSalaries] = await Promise.all([
    db.hrm_nhan_vien.findMany({
      where: buildActiveEmployeeWhere(query),
      select: { ma_nv: true, ho_ten: true, ma_pb: true },
      orderBy: { ma_nv: 'asc' },
    }),
    db.diligenceRecord.findMany({
      where: { periodId: query.periodId },
      include: { violationType: true },
    }),
    db.employeeSalary.findMany({
      where: { status: 'APPROVED' },
      include: {
        items: {
          include: { salaryItem: true },
        },
      },
    }),
  ]);

  // Tra mức phụ cấp chuyên cần được hưởng từ Set lương (loại ATTENDANCE_ALLOWANCE)
  const allowanceMap = new Map<string, number>();
  for (const es of employeeSalaries) {
    for (const it of es.items) {
      if (it.salaryItem.category === 'ATTENDANCE_ALLOWANCE') {
        allowanceMap.set(es.ma_nv, Number(it.amount));
      }
    }
  }

  const recordMap = groupByMaNv(records);

  return employees.map((emp) => {
    const empRecords = recordMap.get(emp.ma_nv) ?? [];
    const donGia = allowanceMap.get(emp.ma_nv) ?? 0;

    let tongPhat = 0;
    let isMấtToànBộ = false;

    for (const r of empRecords) {
      const method = r.violationType.deductionMethod;
      const rate = Number(r.violationType.penaltyRate);
      if (method === 'mat_toan_bo') {
        isMấtToànBộ = true;
      } else if (method === 'theo_gio') {
        tongPhat += rate * (r.violationHours ? Number(r.violationHours) : 1);
      } else {
        // theo_lan
        tongPhat += rate;
      }
    }

    if (isMấtToànBộ) {
      tongPhat = donGia;
    }

    // Bất biến chặn sàn chuyên cần BR-dltl-016: tong_tru = min(tongPhat, donGia)
    const tongTru = Math.min(tongPhat, donGia);
    const thanhTien = Math.max(0, donGia - tongTru);

    return {
      ma_nv: emp.ma_nv,
      ho_ten: emp.ho_ten,
      ma_pb: emp.ma_pb,
      records: empRecords,
      donGia,
      tongTru,
      thanhTien,
      soViPham: empRecords.length,
    };
  });
}

export async function recordDiligenceViolation(db: PrismaClient, input: RecordDiligenceInput) {
  await assertPayrollPeriodWritable(db, input.periodId);

  const violationDate = new Date(input.violationDate);

  // Kiểm tra trùng lặp lỗi trong cùng ngày (E-dltl-019)
  const existing = await db.diligenceRecord.findUnique({
    where: {
      periodId_ma_nv_violationTypeId_violationDate: {
        periodId: input.periodId,
        ma_nv: input.ma_nv,
        violationTypeId: input.violationTypeId,
        violationDate,
      },
    },
  });

  if (existing) {
    throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_019, undefined, HttpStatus.BAD_REQUEST);
  }

  return db.diligenceRecord.create({
    data: {
      periodId: input.periodId,
      ma_nv: input.ma_nv,
      violationTypeId: input.violationTypeId,
      violationDate,
      violationHours: input.violationHours ?? null,
      note: input.note ?? null,
    },
  });
}

export async function deleteDiligenceRecord(db: PrismaClient, id: string) {
  const record = await db.diligenceRecord.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('Không tìm thấy bản ghi vi phạm chuyên cần.');

  await assertPayrollPeriodWritable(db, record.periodId);

  return db.diligenceRecord.delete({ where: { id } });
}

// ==========================================
// 8. ỨNG - BÙ TRỪ (ADJUSTMENTS)
// ==========================================
export async function getAdjustmentsData(db: PrismaClient, query: ListModuleDataQuery) {
  const [employees, records] = await Promise.all([
    db.hrm_nhan_vien.findMany({
      where: buildActiveEmployeeWhere(query),
      select: { ma_nv: true, ho_ten: true, ma_pb: true },
      orderBy: { ma_nv: 'asc' },
    }),
    db.salaryAdjustmentRecord.findMany({
      where: { periodId: query.periodId },
      include: { adjustmentItem: true },
    }),
  ]);

  const recordMap = groupByMaNv(records);

  return employees.map((emp) => {
    const empRecords = recordMap.get(emp.ma_nv) ?? [];
    let tongTru = 0;
    let tongBu = 0;
    for (const r of empRecords) {
      const amt = Number(r.amount);
      if (r.adjustmentItem.direction === 'tru') {
        tongTru += amt;
      } else {
        tongBu += amt;
      }
    }
    // Net adjustment: Dương = khấu trừ lương, Âm = nhận thêm
    const netAdjustment = tongTru - tongBu;

    return {
      ma_nv: emp.ma_nv,
      ho_ten: emp.ho_ten,
      ma_pb: emp.ma_pb,
      records: empRecords,
      tongTru,
      tongBu,
      netAdjustment,
    };
  });
}

export async function applyAdjustments(db: PrismaClient, input: ApplyAdjustmentsInput) {
  await assertPayrollPeriodWritable(db, input.periodId);

  // Kiểm tra trùng khoản bù trừ (E-dltl-022)
  const seenItems = new Set<string>();
  for (const item of input.items) {
    if (seenItems.has(item.adjustmentItemId)) {
      throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_022, undefined, HttpStatus.BAD_REQUEST);
    }
    seenItems.add(item.adjustmentItemId);
  }

  const targetEmployees = await resolveTargetEmployees(db, input.scope, input.ma_pb, input.employeeIds);

  return db.$transaction(async (tx) => {
    await replaceScopedRecords(
      tx.salaryAdjustmentRecord,
      input.periodId,
      targetEmployees.map((e) => e.ma_nv),
      (ma_nv) =>
        input.items.map((it) => ({
          periodId: input.periodId,
          ma_nv,
          adjustmentItemId: it.adjustmentItemId,
          amount: it.amount,
          note: it.note ?? null,
        })),
    );
    return { appliedCount: targetEmployees.length };
  });
}

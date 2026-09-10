import type { GeneralSetting, Holiday, PrismaClient } from '../../../../generated/tenant';
import {
  getPayrollPeriodOrThrow,
  getPayrollPeriodStatusOrThrow,
} from '../../../../helpers/hrm/payrollPeriodLockGuard';
import { groupByMaNv } from '../../../../utils/du_lieu_tinh_luong/payrollAggregation.util';

/** Biểu thuế TNCN 7 bậc lũy tiến từng phần theo Luật Thuế TNCN hiện hành */
export function tinhThueLuyTien(thuNhapTinhThue: number): number {
  if (thuNhapTinhThue <= 0) return 0;

  let thue = 0;
  if (thuNhapTinhThue <= 5_000_000) {
    thue = thuNhapTinhThue * 0.05;
  } else if (thuNhapTinhThue <= 10_000_000) {
    thue = 5_000_000 * 0.05 + (thuNhapTinhThue - 5_000_000) * 0.1;
  } else if (thuNhapTinhThue <= 18_000_000) {
    thue = 5_000_000 * 0.05 + 5_000_000 * 0.1 + (thuNhapTinhThue - 10_000_000) * 0.15;
  } else if (thuNhapTinhThue <= 32_000_000) {
    thue = 5_000_000 * 0.05 + 5_000_000 * 0.1 + 8_000_000 * 0.15 + (thuNhapTinhThue - 18_000_000) * 0.2;
  } else if (thuNhapTinhThue <= 52_000_000) {
    thue = 5_000_000 * 0.05 + 5_000_000 * 0.1 + 8_000_000 * 0.15 + 14_000_000 * 0.2 + (thuNhapTinhThue - 32_000_000) * 0.25;
  } else if (thuNhapTinhThue <= 80_000_000) {
    thue = 5_000_000 * 0.05 + 5_000_000 * 0.1 + 8_000_000 * 0.15 + 14_000_000 * 0.2 + 20_000_000 * 0.25 + (thuNhapTinhThue - 52_000_000) * 0.3;
  } else {
    thue = 5_000_000 * 0.05 + 5_000_000 * 0.1 + 8_000_000 * 0.15 + 14_000_000 * 0.2 + 20_000_000 * 0.25 + 28_000_000 * 0.3 + (thuNhapTinhThue - 80_000_000) * 0.35;
  }

  return Math.round(thue);
}

/**
 * Suy ra ngày công chuẩn của kỳ từ Cấu hình mặc định + Lịch ngày lễ — thay cho hằng số 26
 * hardcode trước đây (BUG-dltl-002 / ADR-dltl-04; gộp luôn "khuyết tật thật" mà ADR-dltl-02 chỉ
 * ra: `createPayrollPeriod` KHÔNG sinh lịch — theo đúng chủ đích giữ mô hình delta — nên chính
 * ENGINE phải tự suy giá trị mặc định ngầm, không được hằng số).
 *
 * - `FIXED_26` / `FIXED_24`: hằng số theo đúng lựa chọn đã cấu hình ở `hrm_general_settings`.
 * - `ACTUAL_MONTH`: đếm số ngày trong tháng theo `saturdayPolicy`/`sundayPolicy`
 *   (`FULL_DAY`=1 công, `HALF_DAY`=0.5 công, `OFF`=0 công), trừ các ngày lễ `isPaid=true` rơi
 *   vào kỳ (ngày lễ hưởng lương không phải "ngày công phải đi làm").
 */
export function resolveStandardWorkDays(
  period: { year: number; month: number },
  setting: GeneralSetting | null,
  holidays: Holiday[],
): number {
  const method = setting?.standardWorkingDaysMethod ?? 'FIXED_26';

  if (method === 'FIXED_24') return 24;
  if (method === 'FIXED_26') return 26;

  // ACTUAL_MONTH
  const saturdayPolicy = setting?.saturdayPolicy ?? 'HALF_DAY';
  const sundayPolicy = setting?.sundayPolicy ?? 'OFF';
  const dayPolicyValue = (policy: string): number => {
    if (policy === 'FULL_DAY') return 1;
    if (policy === 'HALF_DAY') return 0.5;
    return 0; // OFF
  };

  const daysInMonth = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  const paidHolidayDates = new Set(
    holidays.filter((h) => h.isPaid).map((h) => h.date.toISOString().slice(0, 10)),
  );

  let total = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(period.year, period.month - 1, d));
    const isoDate = date.toISOString().slice(0, 10);
    if (paidHolidayDates.has(isoDate)) continue;

    const dow = date.getUTCDay(); // 0 = Chủ nhật, 6 = Thứ 7
    if (dow === 0) total += dayPolicyValue(sundayPolicy);
    else if (dow === 6) total += dayPolicyValue(saturdayPolicy);
    else total += 1;
  }
  return total;
}

/**
 * Tính toán dữ liệu 18 cột lương cho tất cả nhân sự đang làm việc trong kỳ.
 *
 * `preloadedPeriod`: cho phép truyền thẳng kỳ lương đã tải sẵn (vd `lockPayrollPeriod` đã tải để
 * kiểm tra status) thay vì tải lại lần nữa — chỉ áp dụng khi gọi từ trong transaction khóa sổ.
 */
export async function calculatePayrollPreview(
  db: PrismaClient,
  periodId: string,
  preloadedPeriod?: { year: number; month: number; startDate: Date; endDate: Date },
) {
  const period = preloadedPeriod ?? (await getPayrollPeriodOrThrow(db, periodId));

  // 1. Tải Master Data & Cấu hình mặc định
  const [employees, generalSetting, employeeSalaries, phongBans, holidays] = await Promise.all([
    db.hrm_nhan_vien.findMany({
      where: { status: '1', da_xoa: false },
      include: {
        hop_dong: {
          // A-02 (review-findings.md 2026-09-09): CHỈ lấy hợp đồng CÓ HIỆU LỰC TRONG KỲ đang
          // tính — trước đây `orderBy ngay_bat_dau desc take 1` không lọc theo kỳ, nên (a) hợp
          // đồng ký trước cho tháng sau (kèm tăng lương) bị dùng nhầm để tính kỳ hiện tại và
          // (b) hợp đồng đã hết hạn (`ngay_ket_thuc` < đầu kỳ) vẫn được dùng để trả lương.
          // Lưu ý CONTEXT_SUMMARY.md Mục 6.1 QĐ#2: "hợp đồng hiện hành" (chonHopDongHienHanh
          // của module Hợp đồng) KHÔNG đồng nghĩa "đang hiệu lực hôm nay" — payroll phải tự lọc
          // theo period, không tin thẳng cột đó.
          where: {
            ngay_bat_dau: { lte: period.endDate },
            OR: [{ ngay_ket_thuc: null }, { ngay_ket_thuc: { gte: period.startDate } }],
          },
          orderBy: { ngay_bat_dau: 'desc' },
          take: 1,
        },
        nguoi_phu_thuoc: true,
      },
      orderBy: { ma_nv: 'asc' },
    }),
    db.generalSetting.findFirst(),
    db.employeeSalary.findMany({
      where: { status: 'APPROVED' },
      include: {
        items: { include: { salaryItem: true } },
      },
    }),
    db.hrm_phong_ban.findMany(),
    db.holiday.findMany(),
  ]);

  const pbMap = new Map(phongBans.map((p) => [p.ma_pb, p.ten_pb]));

  // 2. Tải toàn bộ 8 khối dữ liệu nhập liệu phát sinh của kỳ
  const [attendances, overtimes, kpis, bonuses, pieceworks, commissions, diligences, adjustments] =
    await Promise.all([
      db.attendanceRecord.findMany({ where: { periodId } }),
      db.overtimeRecord.findMany({ where: { periodId } }),
      db.kpiRecord.findMany({ where: { periodId } }),
      db.bonusRecord.findMany({ where: { periodId } }),
      db.pieceworkRecord.findMany({ where: { periodId } }),
      db.commissionRecord.findMany({ where: { periodId } }),
      db.diligenceRecord.findMany({ where: { periodId }, include: { violationType: true } }),
      db.salaryAdjustmentRecord.findMany({ where: { periodId }, include: { adjustmentItem: true } }),
    ]);

  // Gom dữ liệu theo mã nhân viên
  const attMap = groupByMaNv(attendances);
  const otMap = groupByMaNv(overtimes);
  const kpiMap = groupByMaNv(kpis);
  const bonusMap = groupByMaNv(bonuses);
  const pieceworkMap = groupByMaNv(pieceworks);
  const commissionMap = groupByMaNv(commissions);
  const diligenceMap = groupByMaNv(diligences);
  const adjMap = groupByMaNv(adjustments);

  const esMap = new Map(employeeSalaries.map((es) => [es.ma_nv, es]));

  // BUG-dltl-002 (Cấu hình hardcode, review-findings.md 2026-09-09): trước đây engine chỉ đọc
  // đúng personalDeduction/dependentDeduction từ GeneralSetting, mọi tham số khác hardcode —
  // sửa cấu hình mặc định không làm đổi một đồng nào trong bảng lương. Đọc thêm ngày công
  // chuẩn, giờ chuẩn/ngày, tỷ lệ BHXH/BHYT/BHTN, đoàn phí. Biểu thuế TNCN 7 bậc GIỮ NGUYÊN
  // `tinhThueLuyTien()` (đã đúng luật, không đụng — ngoài phạm vi đợt sửa này).
  const standardWorkDays = resolveStandardWorkDays(period, generalSetting, holidays);
  const standardHoursPerDay = generalSetting ? Number(generalSetting.standardHoursPerDay) : 8.0;
  const personalDeduction = generalSetting ? Number(generalSetting.personalDeduction) : 11_000_000;
  const dependentDeduction = generalSetting ? Number(generalSetting.dependentDeduction) : 4_400_000;
  const employeeInsuranceRate = generalSetting
    ? (Number(generalSetting.insuranceEmployeeSocial) +
        Number(generalSetting.insuranceEmployeeHealth) +
        Number(generalSetting.insuranceEmployeeUnemployment)) /
      100
    : 0.105; // 8% BHXH + 1.5% BHYT + 1% BHTN
  const companyInsuranceRate = generalSetting
    ? (Number(generalSetting.insuranceCompanySocial) +
        Number(generalSetting.insuranceCompanyHealth) +
        Number(generalSetting.insuranceCompanyUnemployment)) /
      100
    : 0.215;
  const unionFeeEmployeeRate = generalSetting ? Number(generalSetting.unionFeeEmployeeRate) / 100 : 0.01;
  const unionFeeMaxAmount = generalSetting ? Number(generalSetting.unionFeeMaxAmount) : 234_000;
  const unionFeeCompanyRate = generalSetting ? Number(generalSetting.unionFeeCompanyRate) / 100 : 0.02;

  // 3. Tính toán cho từng nhân sự
  const results = employees.map((emp) => {
    const activeContract = emp.hop_dong[0] ?? null;
    const es = esMap.get(emp.ma_nv);

    // Mức lương cơ bản thỏa thuận
    const baseSalaryMonthly = activeContract ? Number(activeContract.luong_chinh) : (es ? Number(es.totalAmount) : 0);
    const insuranceSalaryBase = activeContract ? Number(activeContract.luong_bhxh) : baseSalaryMonthly;

    // 1. Chấm công — mô hình DELTA (RVW-001, review-findings.md 2026-09-09).
    // `AttendanceRecord` chỉ ghi qua PUT /attendance/cell khi CÓ NGOẠI LỆ khác chuẩn (ADR-dltl-02
    // giữ nguyên triết lý delta) — KHÔNG PHẢI lịch công đầy đủ cả tháng. Code cũ coi tập bản ghi
    // là lịch cả tháng (`actualWorkDays = sum(workDayValue)` khi có ≥1 bản ghi), nên 1 bản ghi
    // nghỉ-không-lương duy nhất trong tháng làm actualWorkDays sập gần 0 thay vì đúng
    // standardWorkDays - 1. Công thức đúng: mỗi bản ghi delta THAY THẾ đúng 1 ngày công chuẩn
    // của chính nó — actualWorkDays = standardWorkDays + Σ(workDayValue - 1). `workDayValue` bản
    // thân đã phản ánh đúng `attendanceType` (A-03, xem `payrollInputs.service.ts`).
    const empAtt = attMap.get(emp.ma_nv) ?? [];
    const attendanceDelta = empAtt.reduce((sum, r) => sum + (Number(r.workDayValue) - 1), 0);
    let actualWorkDays = standardWorkDays + attendanceDelta;
    actualWorkDays = Math.max(0, Math.min(actualWorkDays, standardWorkDays));
    const proratedWorkSalary = standardWorkDays > 0 ? Math.round((baseSalaryMonthly * actualWorkDays) / standardWorkDays) : 0;

    // 2. Tăng ca
    const empOt = otMap.get(emp.ma_nv) ?? [];
    const otConvertedHours = empOt.reduce((sum, r) => sum + Number(r.convertedHours), 0);
    const hourlyRate = standardWorkDays > 0 ? baseSalaryMonthly / (standardWorkDays * standardHoursPerDay) : 0;
    const otAmount = Math.round(otConvertedHours * hourlyRate);

    // 3. KPI
    const empKpis = kpiMap.get(emp.ma_nv) ?? [];
    let weightedSum = 0;
    let totalWeight = 0;
    for (const r of empKpis) {
      weightedSum += Number(r.completionRate) * r.weight;
      totalWeight += r.weight;
    }
    const kpiScore = totalWeight > 0 ? weightedSum / totalWeight : 100;
    // Tìm khoản lương KPI từ Set lương
    let kpiSalaryBase = 0;
    if (es) {
      for (const it of es.items) {
        if (it.salaryItem.category === 'KPI_PERFORMANCE') {
          kpiSalaryBase += Number(it.amount);
        }
      }
    }
    const kpiSalary = Math.round((kpiSalaryBase * kpiScore) / 100);

    // 4. Thưởng
    const empBonuses = bonusMap.get(emp.ma_nv) ?? [];
    const bonusSalary = empBonuses.reduce((sum, r) => sum + Number(r.amount), 0);

    // 5. Lương sản phẩm
    const empPieceworks = pieceworkMap.get(emp.ma_nv) ?? [];
    const pieceworkSalary = empPieceworks.reduce((sum, r) => sum + Number(r.totalAmount), 0);

    // 6. Lương phần trăm
    const empCommissions = commissionMap.get(emp.ma_nv) ?? [];
    const commissionSalary = empCommissions.reduce((sum, r) => sum + Number(r.totalAmount), 0);

    // 7. Chuyên cần (Bất biến BR-dltl-016: tong_tru = min(sum phat, don_gia))
    let diligenceAllowance = 0;
    if (es) {
      for (const it of es.items) {
        if (it.salaryItem.category === 'ATTENDANCE_ALLOWANCE') {
          diligenceAllowance += Number(it.amount);
        }
      }
    }
    const empDiligences = diligenceMap.get(emp.ma_nv) ?? [];
    let tongPhat = 0;
    for (const r of empDiligences) {
      if (r.violationType.deductionMethod === 'mat_toan_bo') {
        tongPhat = diligenceAllowance;
        break;
      } else if (r.violationType.deductionMethod === 'theo_gio') {
        tongPhat += Number(r.violationType.penaltyRate) * (r.violationHours ? Number(r.violationHours) : 1);
      } else {
        tongPhat += Number(r.violationType.penaltyRate);
      }
    }
    const diligencePenalty = Math.min(tongPhat, diligenceAllowance);
    const diligenceSalary = Math.max(0, diligenceAllowance - diligencePenalty);

    // 8. Ứng - Bù trừ
    const empAdjs = adjMap.get(emp.ma_nv) ?? [];
    let tongTru = 0;
    let tongBu = 0;
    for (const r of empAdjs) {
      const amt = Number(r.amount);
      if (r.adjustmentItem.direction === 'tru') tongTru += amt;
      else tongBu += amt;
    }
    const adjustmentNetAmount = tongTru - tongBu; // Dương: trừ bớt lương, Âm: nhận thêm

    // Tổng thu nhập (Gross Income)
    const grossIncome =
      proratedWorkSalary +
      otAmount +
      pieceworkSalary +
      bonusSalary +
      kpiSalary +
      commissionSalary +
      diligenceSalary;

    // Bảo hiểm & Công đoàn — tỷ lệ đọc từ GeneralSetting (xem khối đọc cấu hình phía trên),
    // không còn hardcode 0.105/0.215/1%/234_000/2% (BUG-dltl-002).
    const employeeInsuranceDeduction = activeContract?.trich_bhxh ? Math.round(insuranceSalaryBase * employeeInsuranceRate) : 0;
    const companyInsuranceExpense = activeContract?.trich_bhxh ? Math.round(insuranceSalaryBase * companyInsuranceRate) : 0;

    const employeeUnionFee = emp.cong_doan ? Math.min(unionFeeMaxAmount, Math.round(insuranceSalaryBase * unionFeeEmployeeRate)) : 0;
    const companyUnionExpense = Math.round(insuranceSalaryBase * unionFeeCompanyRate);

    // Thuế TNCN
    const dependentCount = emp.nguoi_phu_thuoc.length;
    const totalDeductions = personalDeduction + dependentCount * dependentDeduction + employeeInsuranceDeduction;
    const taxableIncome = Math.max(0, grossIncome - totalDeductions);
    const personalIncomeTax = activeContract?.tinh_tncn ? tinhThueLuyTien(taxableIncome) : 0;

    // Thực lĩnh (Net Take-home Pay): EC-03 giữ nguyên số âm nếu tạm ứng vượt lương
    const netTakeHomeSalary =
      grossIncome -
      employeeInsuranceDeduction -
      employeeUnionFee -
      personalIncomeTax -
      adjustmentNetAmount;

    const totalCompanyCost = grossIncome + companyInsuranceExpense + companyUnionExpense;

    return {
      periodId,
      ma_nv: emp.ma_nv,
      employeeCode: emp.ma_nv,
      fullName: emp.ho_ten,
      departmentName: emp.ma_pb ? (pbMap.get(emp.ma_pb) ?? emp.ma_pb) : 'Chưa gán phòng ban',
      positionName: emp.chuc_vu ?? 'Nhân viên',
      contractType: activeContract?.loai_hd ?? 'khong_xac_dinh',
      salaryType: activeContract?.kieu_luong ?? 'GROSS',
      dependentCount,

      baseSalaryMonthly,
      standardWorkDays,
      actualWorkDays,
      otConvertedHours,

      otAmount,
      proratedWorkSalary,
      pieceworkSalary,
      bonusSalary,
      kpiSalary,
      commissionSalary,
      diligenceSalary,
      grossIncome,

      taxableIncome,
      insuranceSalaryBase,
      employeeInsuranceDeduction,
      companyInsuranceExpense,
      employeeUnionFee,
      companyUnionExpense,

      adjustmentNetAmount,
      personalIncomeTax,
      netTakeHomeSalary,
      totalCompanyCost,
    };
  });

  return results;
}

/**
 * Chốt snapshot 18 cột vào bảng hrm_payroll_sheet_lines khi khóa sổ kỳ lương
 */
export async function snapshotPayrollSheet(
  db: PrismaClient,
  periodId: string,
  preloadedPeriod?: { year: number; month: number; startDate: Date; endDate: Date },
) {
  const calculatedLines = await calculatePayrollPreview(db, periodId, preloadedPeriod);

  // Xóa snapshot cũ nếu có và ghi lại toàn bộ trong transaction
  await db.payrollSheetLine.deleteMany({
    where: { periodId },
  });

  if (calculatedLines.length > 0) {
    await db.payrollSheetLine.createMany({
      data: calculatedLines,
    });
  }

  return calculatedLines;
}

/**
 * Lấy bảng lương snapshot đóng băng từ hrm_payroll_sheet_lines
 */
export async function getPayrollSheetLines(db: PrismaClient, periodId: string) {
  const period = await getPayrollPeriodStatusOrThrow(db, periodId);

  // Nếu kỳ chưa khóa (DRAFT hoặc PENDING_REVIEW), trả về tính toán thời gian thực (Live Preview)
  if (period.status === 'DRAFT' || period.status === 'PENDING_REVIEW') {
    return calculatePayrollPreview(db, periodId);
  }

  // Kỳ đã khóa (LOCKED, APPROVED, PAID, ARCHIVED) -> Đọc snapshot đóng băng
  return db.payrollSheetLine.findMany({
    where: { periodId },
    orderBy: { ma_nv: 'asc' },
  });
}

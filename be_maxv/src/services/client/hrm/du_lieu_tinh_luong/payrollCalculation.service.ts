import type { GeneralSetting, Holiday, PrismaClient } from '../../../../generated/tenant';
import {
  SO_LAN_LUONG_CO_SO_TRAN_BHXH_BHYT,
  SO_LAN_LUONG_TOI_THIEU_VUNG_TRAN_BHTN,
} from '../../../../constants/hrm/du_lieu_tinh_luong/insuranceCaps';
import {
  getPayrollPeriodOrThrow,
  getPayrollPeriodStatusOrThrow,
} from '../../../../helpers/hrm/payrollPeriodLockGuard';
import { groupByMaNv } from '../../../../utils/du_lieu_tinh_luong/payrollAggregation.util';
// RVW-025 (review-findings.md 2026-09-10) — `id = SINGLETON_ID` là bản ghi duy nhất của Cấu hình
// mặc định trong toàn hệ thống (`generalSettings.service.ts`); dùng lại đúng khóa đó thay vì
// `findFirst()` không mệnh đề `where`/`orderBy` (không tất định nếu có bản ghi thứ hai lọt vào).
import { SINGLETON_ID } from '../cau_hinh_mac_dinh/generalSettings.service';

/** Phiên bản pipeline đang chạy — snapshot cũ (trước ADR-010) mang "v1", snapshot mới mang "v2". */
const ENGINE_VERSION = 'v2';

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
 * ADR-010 QĐ-3 — Nhận diện hợp đồng khấu trừ 10% tại nguồn (BR-dltl-026, Điều 25 TT 111/2013).
 * Phạm vi CHỐT: đúng `{thu_viec, thoi_vu}`. `khoan`/`xac_dinh` ngắn hạn KHÔNG nằm trong nhóm này
 * (EC-dltl-06/07, chờ kế toán trưởng xác nhận riêng — không chặn tiến độ đợt này).
 *
 * BẮT BUỘC dùng bộ gom nhóm RIÊNG này, KHÔNG dùng lại `loaiHdVeNhanVien()`
 * (`hopDong.service.ts`) — hai luật khác nhau: hàm đó xếp `thoi_vu` vào nhóm `hdld` (hợp đồng lao
 * động thường), trong khi luật thuế cần `thoi_vu` CÙNG NHÓM với `thu_viec`. Gộp chung là tái lập
 * đúng lỗi BUG-HRM-27 (gom ngầm hai luật vào một hàm).
 *
 * Cấm dò chuỗi tiếng Việt — cột `loai_hd` lưu slug ASCII, chuẩn hóa `trim().toLowerCase()`.
 */
export function laHopDongKhauTruTaiNguon(loaiHd: string | null | undefined): boolean {
  const chuan = (loaiHd ?? '').trim().toLowerCase();
  return chuan === 'thu_viec' || chuan === 'thoi_vu';
}

/** Dữ liệu tối thiểu của 1 dòng cấu trúc lương cần cho việc quy đổi + xét miễn thuế. */
interface StructureItemLike {
  calculationMethod: string;
  isOvertimeBase: boolean;
  taxTreatment: string;
}

interface SalaryItemLike {
  code: string;
  name: string;
  category: string;
  isTaxable: boolean;
  isMealAllowance: boolean;
}

interface EmployeeSalaryItemLike {
  salaryItemId: string;
  amount: unknown; // Prisma.Decimal
  salaryItem: SalaryItemLike;
}

/**
 * ADR-010 QĐ-9.2 (chốt `Q-2`, 2026-09-10) — hợp nhất 2 cột miễn thuế theo phép OR, BẤT ĐỐI XỨNG
 * có chủ đích: `EXEMPT`/`isTaxable=false` là khai báo CÓ CHỦ ĐÍCH của kế toán, còn `TAXABLE`/`true`
 * có thể chỉ là giá trị `@default` chưa ai đụng tới (`SalaryStructureItem.taxTreatment` mặc định
 * `TAXABLE`) — không thể cho giá trị mặc định quyền phủ quyết một khai báo có chủ đích.
 */
export function laKhoanMienThue(
  structureItem: StructureItemLike | undefined,
  salaryItem: Pick<SalaryItemLike, 'isTaxable'>,
): boolean {
  return structureItem?.taxTreatment === 'EXEMPT' || salaryItem.isTaxable === false;
}

/** 1 dòng phụ cấp cố định của nhân viên trong kỳ, đã quy đổi công + phân giỏ miễn thuế (ADR-010 bước [1]/[2]/[5a]). */
export interface DongPhuCapKy {
  salaryItemId: string;
  code: string;
  name: string;
  category: 'FIXED_ALLOWANCE' | 'BENEFIT_ALLOWANCE';
  calculationMethod: string;
  isOvertimeBase: boolean;
  isMealAllowance: boolean;
  isTaxable: boolean;
  /** Mức THÁNG, chưa quy đổi công — dùng cho `fixedAllowanceTotal` (cột "Lương"). */
  monthlyAmount: number;
  /** Mức SAU quy đổi công theo `calculationMethod` riêng của khoản — dùng cho `grossIncome`. */
  proratedAmount: number;
  /** Giỏ miễn thuế (ADR-010 QĐ-9.3 — LOẠI TRỪ NHAU, dừng ở giỏ đầu tiên khớp). */
  bucket: 'MEAL_ALLOWANCE' | 'EXEMPT_DECLARED' | 'TAXABLE';
}

/**
 * ADR-010 QĐ-8 — DÙNG CHUNG cho cả `GET /payroll/calculate` VÀ `GET /payroll/support-allowances`.
 * CẤM chép công thức lần hai: hai endpoint mà mỗi bên tự viết lại vòng lặp này thì bất biến
 * `support-allowances.total` == phần BENEFIT_ALLOWANCE trong `allowanceInPeriodTotal` không còn
 * gì bảo đảm.
 *
 * Duyệt CÙNG MỘT vòng lặp cho cả quy đổi công lẫn phân giỏ miễn thuế (ADR-010 ràng buộc thứ tự
 * [5a]): cấm hai vòng lặp độc lập cộng vào hai biến — đó chính là chỗ sinh lỗi cộng đôi
 * (`mealAllowanceAmount` và `otherAllowanceTaxExemptAmount` LOẠI TRỪ NHAU).
 *
 * Chỉ xử lý `category ∈ {FIXED_ALLOWANCE, BENEFIT_ALLOWANCE}` — đây chính là phạm vi của
 * `allowanceInPeriodTotal` (SRS 15.3.1, ADR-010 QĐ-9.1). Thưởng/hoa hồng/KPI/lương sản phẩm/
 * chuyên cần KHÔNG đi qua hàm này (giữ nguyên hành vi hiện tại, không đọc `isTaxable` của chúng).
 */
export function tinhKhoanPhuCapTheoKy(
  esItems: EmployeeSalaryItemLike[],
  structureItemMap: Map<string, StructureItemLike>,
  tyLeCong: number,
): DongPhuCapKy[] {
  const rows: DongPhuCapKy[] = [];

  for (const it of esItems) {
    const category = it.salaryItem.category;
    if (category !== 'FIXED_ALLOWANCE' && category !== 'BENEFIT_ALLOWANCE') continue;

    // data-model Mục 11.5 — khoản KHÔNG có dòng trong cấu trúc lương hiệu lực của kỳ: mặc định
    // MONTHLY_FIXED + isOvertimeBase=false + xét miễn thuế CHỈ theo SalaryItem.isTaxable.
    const structureItem = structureItemMap.get(it.salaryItemId);
    const calculationMethod = structureItem?.calculationMethod ?? 'MONTHLY_FIXED';
    const isOvertimeBase = structureItem?.isOvertimeBase ?? false;

    const monthlyAmount = Number(it.amount);
    const proratedAmount =
      calculationMethod === 'ACTUAL_WORKDAYS' || calculationMethod === 'HOURLY'
        ? Math.round(monthlyAmount * tyLeCong)
        : monthlyAmount;

    // ADR-010 bước [5a] — phân giỏ theo THỨ TỰ, dừng ở giỏ đầu tiên khớp. Ba giỏ LOẠI TRỪ NHAU.
    let bucket: DongPhuCapKy['bucket'];
    if (it.salaryItem.isMealAllowance) {
      bucket = 'MEAL_ALLOWANCE'; // (i) — bỏ qua ô tick miễn thuế của chính khoản này (QĐ-9.3)
    } else if (laKhoanMienThue(structureItem, it.salaryItem)) {
      bucket = 'EXEMPT_DECLARED'; // (ii)
    } else {
      bucket = 'TAXABLE'; // (iii)
    }

    rows.push({
      salaryItemId: it.salaryItemId,
      code: it.salaryItem.code,
      name: it.salaryItem.name,
      category,
      calculationMethod,
      isOvertimeBase,
      isMealAllowance: it.salaryItem.isMealAllowance,
      isTaxable: it.salaryItem.isTaxable,
      monthlyAmount,
      proratedAmount,
      bucket,
    });
  }

  return rows;
}

/**
 * data-model Mục 11.5 — chọn cấu trúc lương ĐANG HIỆU LỰC TRONG KỲ: `isActive=true` VÀ phủ kỳ
 * (`effectiveFrom <= period.endDate` VÀ (`effectiveTo` null HOẶC `>= period.startDate`)),
 * `orderBy effectiveFrom desc, take 1` — cùng nguyên tắc "lọc theo kỳ" đã áp cho hợp đồng (A-02).
 *
 * Trả về `Map<salaryItemId, StructureItemLike>` của cấu trúc đã chọn (rỗng nếu không có cấu trúc
 * nào phủ kỳ — khi đó MỌI khoản rơi về mặc định ở `tinhKhoanPhuCapTheoKy`).
 */
async function getActiveStructureItemMap(
  db: PrismaClient,
  period: { startDate: Date; endDate: Date },
): Promise<Map<string, StructureItemLike>> {
  const structures = await db.salaryStructure.findMany({
    where: {
      isActive: true,
      effectiveFrom: { lte: period.endDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    take: 1,
    include: { items: true },
  });

  const map = new Map<string, StructureItemLike>();
  const structure = structures[0];
  if (structure) {
    for (const item of structure.items) {
      map.set(item.salaryItemId, {
        calculationMethod: item.calculationMethod,
        isOvertimeBase: item.isOvertimeBase,
        taxTreatment: item.taxTreatment,
      });
    }
  }
  return map;
}

/**
 * Tính toán dữ liệu bảng lương tổng hợp cho tất cả nhân sự đang làm việc trong kỳ.
 *
 * Pipeline 10 bước theo ADR-010 (`docs/hrm/architecture/adr/ADR-010-pipeline-thue-bao-hiem-bang-luong.md`)
 * — THỨ TỰ CÁC BƯỚC LÀ QUYẾT ĐỊNH KIẾN TRÚC, không phải sở thích viết mã. Đảo thứ tự là SAI SỐ TIỀN,
 * không phải sai phong cách.
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
  const [employees, generalSetting, employeeSalaries, phongBans, holidays, structureItemMap] =
    await Promise.all([
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
      db.generalSetting.findUnique({ where: { id: SINGLETON_ID } }),
      // RVW-021 (review-findings.md 2026-09-10) — lọc set lương ĐANG HIỆU LỰC TRONG KỲ, cùng
      // nguyên tắc "lọc theo kỳ" đã áp cho hợp đồng (A-02, xem `include.hop_dong` ở trên). Trước
      // đây chỉ lọc `status`, nên set lương ký hiệu lực từ THÁNG SAU vẫn bị dùng nhầm cho kỳ đang
      // tính (`ma_nv` là `@unique` nên mỗi nhân viên chỉ có 1 bản ghi — không "chọn bản phủ kỳ"
      // như hợp đồng được, chỉ có thể bỏ qua nếu chưa/đã hết hiệu lực).
      db.employeeSalary.findMany({
        where: {
          status: 'APPROVED',
          effectiveFrom: { lte: period.endDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }],
        },
        include: {
          items: { include: { salaryItem: true } },
        },
      }),
      db.hrm_phong_ban.findMany(),
      db.holiday.findMany(),
      getActiveStructureItemMap(db, period),
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
  const employeeInsuranceSocialHealthRate = generalSetting
    ? (Number(generalSetting.insuranceEmployeeSocial) + Number(generalSetting.insuranceEmployeeHealth)) / 100
    : 0.095; // 8% BHXH + 1.5% BHYT
  const employeeInsuranceUnemploymentRate = generalSetting
    ? Number(generalSetting.insuranceEmployeeUnemployment) / 100
    : 0.01;
  const companyInsuranceSocialHealthRate = generalSetting
    ? (Number(generalSetting.insuranceCompanySocial) + Number(generalSetting.insuranceCompanyHealth)) / 100
    : 0.205; // 17.5% BHXH + 3% BHYT
  const companyInsuranceUnemploymentRate = generalSetting
    ? Number(generalSetting.insuranceCompanyUnemployment) / 100
    : 0.01;
  const unionFeeEmployeeRate = generalSetting ? Number(generalSetting.unionFeeEmployeeRate) / 100 : 0.01;
  const unionFeeMaxAmount = generalSetting ? Number(generalSetting.unionFeeMaxAmount) : 234_000;
  const unionFeeCompanyRate = generalSetting ? Number(generalSetting.unionFeeCompanyRate) / 100 : 0.02;

  // ADR-010 QĐ-2 — hai gốc trần bảo hiểm (BR-dltl-024). Hệ số `× 20` là HẰNG SỐ có căn cứ luật
  // (constants/hrm/du_lieu_tinh_luong/insuranceCaps.ts), KHÔNG phải cột cấu hình.
  const baseSalary = generalSetting ? Number(generalSetting.baseSalary) : 2_340_000;
  const regionMinSalary = generalSetting ? Number(generalSetting.regionMinSalary) : 4_960_000;
  const capBhxhBytTran = baseSalary * SO_LAN_LUONG_CO_SO_TRAN_BHXH_BHYT;
  const capBhtnTran = regionMinSalary * SO_LAN_LUONG_TOI_THIEU_VUNG_TRAN_BHTN;

  // ADR-010 QĐ-2 — 3 tham số mới (BR-dltl-026/027), cột `GeneralSetting`.
  const lunchAllowanceTaxFreeCap = generalSetting ? Number(generalSetting.lunchAllowanceTaxFreeCap) : 730_000;
  const withholdingTaxRate = generalSetting ? Number(generalSetting.withholdingTaxRate) : 10.0;
  const withholdingTaxThreshold = generalSetting ? Number(generalSetting.withholdingTaxThreshold) : 2_000_000;

  // 3. Tính toán cho từng nhân sự
  const results = employees.map((emp) => {
    const activeContract = emp.hop_dong[0] ?? null;
    const es = esMap.get(emp.ma_nv);

    // ── [1] Nền lương 2 tầng (QĐ nghiệp vụ 1, SRS 15.4) ──
    const contractBaseSalary = activeContract
      ? Number(activeContract.luong_chinh)
      : es
        ? Number(es.totalAmount)
        : 0;
    const insuranceSalaryBase = activeContract ? Number(activeContract.luong_bhxh) : contractBaseSalary;

    // 1. Chấm công — mô hình DELTA (RVW-001, review-findings.md 2026-09-09).
    // `AttendanceRecord` chỉ ghi qua PUT /attendance/cell khi CÓ NGOẠI LỆ khác chuẩn (ADR-dltl-02
    // giữ nguyên triết lý delta) — KHÔNG PHẢI lịch công đầy đủ cả tháng. Công thức đúng: mỗi bản
    // ghi delta THAY THẾ đúng 1 ngày công chuẩn của chính nó — actualWorkDays =
    // standardWorkDays + Σ(workDayValue - 1). `workDayValue` bản thân đã phản ánh đúng
    // `attendanceType` (A-03, xem `payrollInputs.service.ts`).
    const empAtt = attMap.get(emp.ma_nv) ?? [];
    const attendanceDelta = empAtt.reduce((sum, r) => sum + (Number(r.workDayValue) - 1), 0);
    let actualWorkDays = standardWorkDays + attendanceDelta;
    actualWorkDays = Math.max(0, Math.min(actualWorkDays, standardWorkDays));
    const tyLeCong = standardWorkDays > 0 ? Math.min(actualWorkDays / standardWorkDays, 1) : 0;

    // Phụ cấp cố định — MỘT vòng lặp dùng chung cho quy đổi công + phân giỏ miễn thuế
    // (ADR-010 QĐ-8, ràng buộc thứ tự [5a]).
    const phuCapRows = es ? tinhKhoanPhuCapTheoKy(es.items, structureItemMap, tyLeCong) : [];
    const fixedAllowanceTotal = phuCapRows.reduce((sum, r) => sum + r.monthlyAmount, 0);
    const allowanceInPeriodTotal = phuCapRows.reduce((sum, r) => sum + r.proratedAmount, 0);
    const baseSalaryMonthly = contractBaseSalary + fixedAllowanceTotal; // cột UI "Lương"

    // ── [2] Quy đổi theo công — CHỈ phần hợp đồng (SRS 15.5 giữ nguyên nghĩa) ──
    const proratedWorkSalary = Math.round(contractBaseSalary * tyLeCong);

    // ── [3] Tăng ca (ADR-010 QĐ-1) ──
    // otBase KHÔNG dùng baseSalaryMonthly (đã gồm phụ cấp) — chỉ contractBaseSalary + khoản có
    // isOvertimeBase=true, mặc định false ⇒ hành vi mặc định = contractBaseSalary (B-5).
    const otOvertimeBaseAllowance = phuCapRows.reduce(
      (sum, r) => sum + (r.isOvertimeBase ? r.monthlyAmount : 0),
      0,
    );
    const otBase = contractBaseSalary + otOvertimeBaseAllowance;
    const otHourlyRate = standardWorkDays > 0 ? otBase / (standardWorkDays * standardHoursPerDay) : 0;

    const empOt = otMap.get(emp.ma_nv) ?? [];
    let otAmount = 0;
    let otTaxExemptAmount = 0;
    let otConvertedHours = 0;
    let otRawHours = 0;
    for (const r of empOt) {
      const convertedHours = Number(r.convertedHours);
      const hours = Number(r.hours);
      const tienOtR = Math.round(otHourlyRate * convertedHours);
      const tienChuanR = Math.round(otHourlyRate * hours);
      otAmount += tienOtR;
      otTaxExemptAmount += Math.max(0, tienOtR - tienChuanR);
      otConvertedHours += convertedHours;
      otRawHours += hours;
    }

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

    // ── [4] Gộp thu nhập (Gross Income) ──
    const grossIncome =
      proratedWorkSalary +
      allowanceInPeriodTotal +
      otAmount +
      pieceworkSalary +
      bonusSalary +
      kpiSalary +
      commissionSalary +
      diligenceSalary;

    // ── [5] Bóc MIỄN THUẾ (trước bảo hiểm) ──
    // 5a. Phân giỏ đã có sẵn trong phuCapRows (cùng vòng lặp với quy đổi công ở [1]/[2]).
    const mealAllowanceAmount = phuCapRows.reduce(
      (sum, r) => sum + (r.bucket === 'MEAL_ALLOWANCE' ? r.proratedAmount : 0),
      0,
    );
    const otherAllowanceTaxExemptAmount = phuCapRows.reduce(
      (sum, r) => sum + (r.bucket === 'EXEMPT_DECLARED' ? r.proratedAmount : 0),
      0,
    );

    // 5c. Trần miễn thuế ăn ca — quy đổi theo công (AC-dltl-23).
    const hanMucMienThue = Math.round(lunchAllowanceTaxFreeCap * tyLeCong);
    const lunchAllowanceExemptAmount = Math.min(mealAllowanceAmount, hanMucMienThue);
    const lunchAllowanceTaxableAmount = mealAllowanceAmount - lunchAllowanceExemptAmount;

    // 5d. Tổng miễn thuế — BA cấu phần, KHÔNG giao nhau (ADR-010 ràng buộc thứ tự thứ 4).
    const tongMienThue = otTaxExemptAmount + lunchAllowanceExemptAmount + otherAllowanceTaxExemptAmount;
    const thuNhapTruocGiamTru = grossIncome - tongMienThue;

    // ── [6] HAI TRẦN BẢO HIỂM (độc lập nhau, BR-dltl-024) ──
    const capBhxhByt = Math.min(insuranceSalaryBase, capBhxhBytTran);
    const capBhtn = Math.min(insuranceSalaryBase, capBhtnTran);
    const employeeInsuranceDeduction = activeContract?.trich_bhxh
      ? Math.round(capBhxhByt * employeeInsuranceSocialHealthRate) +
        Math.round(capBhtn * employeeInsuranceUnemploymentRate)
      : 0;
    const companyInsuranceExpense = activeContract?.trich_bhxh
      ? Math.round(capBhxhByt * companyInsuranceSocialHealthRate) +
        Math.round(capBhtn * companyInsuranceUnemploymentRate)
      : 0;
    const insuranceCapAppliedBhxhByt = insuranceSalaryBase > capBhxhBytTran;
    const insuranceCapAppliedBhtn = insuranceSalaryBase > capBhtnTran;

    // ── [7] Công đoàn — giữ nguyên công thức hiện tại. KHÔNG phải khoản giảm trừ thuế (QĐ-5) ──
    const employeeUnionFee = emp.cong_doan
      ? Math.min(unionFeeMaxAmount, Math.round(insuranceSalaryBase * unionFeeEmployeeRate))
      : 0;
    const companyUnionExpense = Math.round(insuranceSalaryBase * unionFeeCompanyRate);

    // ── [8] RẼ NHÁNH THUẾ (BR-dltl-026, ADR-010 QĐ-3) ──
    const dependentCount = emp.nguoi_phu_thuoc.length;
    const totalDeductions = personalDeduction + dependentCount * dependentDeduction + employeeInsuranceDeduction;
    const isWithholdingGroup = laHopDongKhauTruTaiNguon(activeContract?.loai_hd);

    // `taxableIncome` đổi Ý NGHĨA theo nhóm hợp đồng (api-contract Mục 8.1.2) — KHÔNG phụ thuộc
    // `tinh_tncn`/ngưỡng, để luôn giải trình được "thu nhập tính thuế đáng lẽ là bao nhiêu".
    const taxableIncome = isWithholdingGroup
      ? thuNhapTruocGiamTru
      : Math.max(0, thuNhapTruocGiamTru - totalDeductions);

    let personalIncomeTax = 0;
    let withholdingTaxApplied = false;
    if (activeContract?.tinh_tncn) {
      // `tinh_tncn ≠ true` là công tắc TỔNG, kiểm TRƯỚC — đè lên cả 2 cơ chế (GAP-QA-05).
      if (isWithholdingGroup) {
        if (thuNhapTruocGiamTru >= withholdingTaxThreshold) {
          personalIncomeTax = Math.round(thuNhapTruocGiamTru * (withholdingTaxRate / 100));
          withholdingTaxApplied = true;
        } // ngược lại: thuế 0, withholdingTaxApplied=false (AC-dltl-19)
      } else {
        personalIncomeTax = tinhThueLuyTien(taxableIncome);
      }
    }

    // ── [9] Thực lĩnh (Net Take-home Pay): EC-03 giữ nguyên số âm nếu tạm ứng vượt lương ──
    const netTakeHomeSalary =
      grossIncome -
      employeeInsuranceDeduction -
      employeeUnionFee -
      personalIncomeTax -
      adjustmentNetAmount;

    // ── [10] Chi phí công ty ──
    const totalCompanyCost = grossIncome + companyInsuranceExpense + companyUnionExpense;

    return {
      periodId,
      ma_nv: emp.ma_nv,
      employeeCode: emp.ma_nv,
      fullName: emp.ho_ten,
      departmentName: emp.ma_pb ? (pbMap.get(emp.ma_pb) ?? emp.ma_pb) : 'Chưa gán phòng ban',
      positionName: emp.chuc_vu ?? 'Nhân viên',
      // B-4 (api-contract Mục 8.1.3) — `null` khi KHÔNG có hợp đồng hiệu lực trong kỳ, không còn
      // giá trị bịa "khong_xac_dinh"/"GROSS" che mất tình trạng thật.
      contractType: activeContract?.loai_hd ?? null,
      salaryType: activeContract?.kieu_luong ?? null,
      dependentCount,

      contractBaseSalary,
      fixedAllowanceTotal,
      baseSalaryMonthly,
      allowanceInPeriodTotal,

      standardWorkDays,
      actualWorkDays,
      otRawHours,
      otConvertedHours,

      proratedWorkSalary,
      otAmount,
      pieceworkSalary,
      bonusSalary,
      kpiSalary,
      commissionSalary,
      diligenceSalary,
      grossIncome,

      otTaxExemptAmount,
      mealAllowanceAmount,
      lunchAllowanceExemptAmount,
      lunchAllowanceTaxableAmount,
      otherAllowanceTaxExemptAmount,

      insuranceSalaryBase,
      insuranceBaseBhxhByt: capBhxhByt,
      insuranceBaseBhtn: capBhtn,
      insuranceCapAppliedBhxhByt,
      insuranceCapAppliedBhtn,
      employeeInsuranceDeduction,
      companyInsuranceExpense,
      employeeUnionFee,
      companyUnionExpense,

      withholdingTaxApplied,
      taxableIncome,
      personalIncomeTax,

      adjustmentNetAmount,
      netTakeHomeSalary,
      totalCompanyCost,
      engineVersion: ENGINE_VERSION,
    };
  });

  return results;
}

/**
 * Chốt snapshot vào bảng hrm_payroll_sheet_lines khi khóa sổ kỳ lương.
 *
 * 🔴 `calculatePayrollPreview()` trả về NGUYÊN object đưa thẳng vào `createMany` — mọi field trả
 * về BẮT BUỘC khớp đúng cột đã khai ở `prisma/tenant/schema.prisma` model `PayrollSheetLine`
 * (data-model-du-lieu-tinh-luong.md Mục 11.4). Thêm field mà thiếu cột ⇒ Prisma ném
 * `Unknown argument` và khóa sổ GÃY HOÀN TOÀN, trong khi `GET /payroll/calculate` vẫn chạy bình
 * thường — lỗi chỉ lộ ra lúc kế toán bấm "Khóa sổ".
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

/**
 * `GET /payroll/support-allowances` — bóc tách phần phụ cấp hỗ trợ (`category=BENEFIT_ALLOWANCE`)
 * VỐN ĐÃ NẰM TRONG cột "Thu nhập" của `/payroll/calculate` thành từng khoản, KHÔNG PHẢI khoản chi
 * thêm (api-contract Mục 8.2, ADR-010 QĐ-8).
 *
 * 🔴 Bất biến bắt buộc: với cùng `periodId` + cùng nhân viên, `total` trả về ở đây phải BẰNG ĐÚNG
 * phần `BENEFIT_ALLOWANCE` mà `/payroll/calculate` đã cộng vào `allowanceInPeriodTotal`. Bảo đảm
 * bằng cách gọi CHUNG `tinhKhoanPhuCapTheoKy()` — cấm chép công thức lần hai.
 *
 * RVW-019 (review-findings.md 2026-09-10) — `total`/`columns` nay CÙNG lọc `SalaryItem.status =
 * 'ACTIVE'` (trước đây `total` cộng cả khoản `INACTIVE`, `columns` thì không ⇒ bảng không tự cộng
 * khớp tổng của chính nó). Hệ quả CÒN MỞ, cố ý CHƯA sửa (cần BA chốt ngữ nghĩa `SalaryItem.status`
 * trước — xem "Ghi chú kèm" của RVW-019): bất biến ở trên nay chỉ đúng khi nhân viên KHÔNG có
 * khoản `BENEFIT_ALLOWANCE` nào đã bị chuyển `INACTIVE` — vì `tinhKhoanPhuCapTheoKy()` (dùng
 * chung với `/payroll/calculate`) KHÔNG lọc `status`, nên `allowanceInPeriodTotal` vẫn cộng cả
 * khoản `INACTIVE`. Đây là khoảng lệch đã biết, không phải lỗi mới phát sinh từ đợt sửa này.
 *
 * RVW-020 — kỳ đã khóa (`LOCKED`/`APPROVED`/`PAID`/`ARCHIVED`) vẫn tính LIVE ở đây (KHÔNG đọc
 * snapshot như `getPayrollSheetLines`) vì `PayrollSheetLine` chỉ lưu tổng `allowanceInPeriodTotal`,
 * không lưu bóc tách theo từng khoản — khoảng trống thiết kế của ADR-010, cần Architect quyết
 * định có thêm bảng/cột snapshot bóc tách hay không (ghi ADR trước khi code). Giải pháp ngắn hạn
 * đã áp: trả kèm `periodStatus` + `isLiveRecalculated` để FE cảnh báo tại chỗ khi kỳ đã khóa.
 */
export async function getSupportAllowanceBreakdown(db: PrismaClient, periodId: string) {
  const period = await getPayrollPeriodOrThrow(db, periodId);

  const [employees, generalSetting, employeeSalaries, phongBans, holidays, attendances, activeSalaryItems, structureItemMap] =
    await Promise.all([
      db.hrm_nhan_vien.findMany({
        where: { status: '1', da_xoa: false },
        include: {
          hop_dong: {
            where: {
              ngay_bat_dau: { lte: period.endDate },
              OR: [{ ngay_ket_thuc: null }, { ngay_ket_thuc: { gte: period.startDate } }],
            },
            orderBy: { ngay_bat_dau: 'desc' },
            take: 1,
          },
        },
        orderBy: { ma_nv: 'asc' },
      }),
      db.generalSetting.findUnique({ where: { id: SINGLETON_ID } }),
      // RVW-021 — cùng bộ lọc theo kỳ đã áp cho `calculatePayrollPreview` ở trên: sửa MỘT nơi mà
      // bỏ nơi kia thì hai endpoint lại lệch nhau (đúng loại lỗi mà bất biến ở đầu hàm này cấm).
      db.employeeSalary.findMany({
        where: {
          status: 'APPROVED',
          effectiveFrom: { lte: period.endDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }],
        },
        include: { items: { include: { salaryItem: true } } },
      }),
      db.hrm_phong_ban.findMany(),
      db.holiday.findMany(),
      db.attendanceRecord.findMany({ where: { periodId } }),
      db.salaryItem.findMany({
        where: { category: 'BENEFIT_ALLOWANCE', status: 'ACTIVE' },
        orderBy: { code: 'asc' },
      }),
      getActiveStructureItemMap(db, period),
    ]);

  const pbMap = new Map(phongBans.map((p) => [p.ma_pb, p.ten_pb]));
  const esMap = new Map(employeeSalaries.map((es) => [es.ma_nv, es]));
  const attMap = groupByMaNv(attendances);
  const standardWorkDays = resolveStandardWorkDays(period, generalSetting, holidays);

  // "Cột động" — MỌI SalaryItem category=BENEFIT_ALLOWANCE, status=ACTIVE, KỂ CẢ khoản mà chưa
  // nhân viên nào được gán (cột hiện với toàn số 0 — đúng hành vi mock đã có ở FE).
  const columns = activeSalaryItems.map((si) => ({
    code: si.code,
    name: si.name,
    calculationMethod: structureItemMap.get(si.id)?.calculationMethod ?? 'MONTHLY_FIXED',
    isTaxable: si.isTaxable,
    isMealAllowance: si.isMealAllowance,
  }));
  const columnCodes = new Set(columns.map((c) => c.code));

  const items = employees.map((emp) => {
    const activeContract = emp.hop_dong[0] ?? null;
    const es = esMap.get(emp.ma_nv);

    const empAtt = attMap.get(emp.ma_nv) ?? [];
    const attendanceDelta = empAtt.reduce((sum, r) => sum + (Number(r.workDayValue) - 1), 0);
    let actualWorkDays = standardWorkDays + attendanceDelta;
    actualWorkDays = Math.max(0, Math.min(actualWorkDays, standardWorkDays));
    const tyLeCong = standardWorkDays > 0 ? Math.min(actualWorkDays / standardWorkDays, 1) : 0;

    // MỘT hàm dùng chung với `/payroll/calculate` (ADR-010 QĐ-8) — không chép công thức lần hai.
    const rows = es ? tinhKhoanPhuCapTheoKy(es.items, structureItemMap, tyLeCong) : [];
    const benefitRows = rows.filter((r) => r.category === 'BENEFIT_ALLOWANCE');

    const amounts: Record<string, number> = {};
    for (const code of columnCodes) amounts[code] = 0;
    let monthlyTotal = 0;
    let total = 0;
    for (const row of benefitRows) {
      // RVW-019 (review-findings.md 2026-09-10) — TRƯỚC ĐÂY `total`/`monthlyTotal` cộng vô điều
      // kiện mọi `benefitRows`, kể cả khoản đã `INACTIVE` ở danh mục (không có cột hiển thị nào
      // giải thích phần chênh) ⇒ Σ amounts < total, bảng không tự cộng khớp tổng của chính nó.
      // Áp ĐÚNG MỘT quy tắc lọc cho cả `columns` lẫn `total`: chỉ cộng khoản đang nằm trong
      // `columnCodes` (đã lọc `status='ACTIVE'` khi dựng `columns` ở trên).
      if (!columnCodes.has(row.code)) continue;
      amounts[row.code] = row.proratedAmount;
      monthlyTotal += row.monthlyAmount;
      total += row.proratedAmount;
    }

    return {
      ma_nv: emp.ma_nv,
      employeeCode: emp.ma_nv,
      fullName: emp.ho_ten,
      departmentName: emp.ma_pb ? (pbMap.get(emp.ma_pb) ?? emp.ma_pb) : 'Chưa gán phòng ban',
      positionName: emp.chuc_vu ?? 'Nhân viên',
      contractType: activeContract?.loai_hd ?? null,
      salaryType: activeContract?.kieu_luong ?? null,
      actualWorkDays,
      standardWorkDays,
      amounts,
      monthlyTotal,
      total,
    };
  });

  // RVW-020 — endpoint này LUÔN tính live (không đọc snapshot, xem docstring ở trên). Trả kèm
  // `periodStatus` + `isLiveRecalculated` để FE tự cảnh báo khi kỳ đã khóa (`LOCKED`/`APPROVED`/
  // `PAID`/`ARCHIVED`) — vì lúc đó số ở đây có thể lệch với `/payroll/sheet-lines` (đọc snapshot
  // đóng băng) nếu có ai sửa mức phụ cấp SAU khi khóa sổ.
  return {
    periodId,
    periodStatus: period.status,
    isLiveRecalculated: true,
    standardWorkDays,
    columns,
    items,
  };
}

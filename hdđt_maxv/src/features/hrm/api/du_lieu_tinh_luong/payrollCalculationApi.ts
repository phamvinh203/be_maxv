/**
 * Lớp gọi API thô của "Bảng lương tổng hợp" — khớp NGUYÊN VĂN
 * `docs/hrm/du_lieu_tinh_luong/api-contract-du-lieu-tinh-luong.md` Mục 8 (hợp đồng MỞ RỘNG,
 * 2026-09-10). Tên trường bám đúng response thật của `payrollCalculation.service.ts`
 * (`be_maxv`) — KHÔNG đổi tên khác, KHÔNG rút gọn.
 *
 * File này CHỈ khai kiểu + gọi HTTP thô. Việc đổi sang kiểu FE (`DongBangLuong`/`DongLuongHoTro`)
 * và quy đổi 2 cạm bẫy field (`otRawHours` vs `otConvertedHours`, `taxableIncome` đổi nghĩa theo
 * nhánh) nằm ở `api/bang_luong/bangLuongQueries.ts` — đọc file đó trước khi đụng vào đây.
 */

import { api } from "@/lib/apiClient";

const BASE = "/hrm/payroll";

/**
 * Một dòng bảng lương của một nhân viên trong kỳ — 44 trường (api-contract Mục 8.1).
 *
 * `contractType`/`salaryType` là `null` khi nhân viên KHÔNG có hợp đồng hiệu lực trong kỳ (B-4)
 * — ĐỪNG bịa giá trị mặc định để che tình trạng "chưa có hợp đồng".
 */
export interface PayrollCalculationLineApi {
  periodId: string;
  ma_nv: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  positionName: string;
  contractType: string | null;
  salaryType: string | null;
  dependentCount: number;

  // Nguồn lương 2 tầng (SRS 15.4) — cột UI "Lương" = contractBaseSalary + fixedAllowanceTotal.
  contractBaseSalary: number;
  fixedAllowanceTotal: number;
  baseSalaryMonthly: number;
  allowanceInPeriodTotal: number;

  standardWorkDays: number;
  actualWorkDays: number;
  /** Giờ tăng ca GỐC (chưa nhân hệ số) — dùng cho cột UI "Giờ tăng ca". */
  otRawHours: number;
  /** Giờ tăng ca ĐÃ nhân hệ số — ⚠️ KHÔNG dùng cho cột "Giờ tăng ca" (api-contract 8.1.1). */
  otConvertedHours: number;

  proratedWorkSalary: number;
  otAmount: number;
  pieceworkSalary: number;
  bonusSalary: number;
  kpiSalary: number;
  commissionSalary: number;
  diligenceSalary: number;
  grossIncome: number;

  // Bóc miễn thuế — 3 cấu phần KHÔNG giao nhau (ADR-010 QĐ-9.3).
  otTaxExemptAmount: number;
  mealAllowanceAmount: number;
  lunchAllowanceExemptAmount: number;
  lunchAllowanceTaxableAmount: number;
  otherAllowanceTaxExemptAmount: number;

  insuranceSalaryBase: number;
  insuranceBaseBhxhByt: number;
  insuranceBaseBhtn: number;
  insuranceCapAppliedBhxhByt: boolean;
  insuranceCapAppliedBhtn: boolean;
  employeeInsuranceDeduction: number;
  companyInsuranceExpense: number;
  employeeUnionFee: number;
  companyUnionExpense: number;

  /** `true` = khấu trừ 10% tại nguồn (HĐ thử việc/thời vụ); `false` = lũy tiến 7 bậc. */
  withholdingTaxApplied: boolean;
  /**
   * ⚠️ Ý NGHĨA PHỤ THUỘC `withholdingTaxApplied` (api-contract 8.1.2) — TUYỆT ĐỐI KHÔNG dùng
   * trực tiếp cho cột UI "Thu nhập chịu thuế". Suy field đó từ 4 số hạng khác, xem
   * `bangLuongQueries.ts`.
   */
  taxableIncome: number;
  personalIncomeTax: number;

  adjustmentNetAmount: number;
  netTakeHomeSalary: number;
  totalCompanyCost: number;
  /** Phiên bản pipeline đã dùng để tính dòng này ("v1" snapshot cũ trước ADR-010, "v2" hiện tại). */
  engineVersion: string;
}

/** Một cột động của tab "Lương hỗ trợ" — mọi `SalaryItem` category=BENEFIT_ALLOWANCE, status=ACTIVE. */
export interface SupportAllowanceColumnApi {
  code: string;
  name: string;
  calculationMethod: string;
  isTaxable: boolean;
  isMealAllowance: boolean;
}

/** Một dòng nhân viên của tab "Lương hỗ trợ" — `amounts` khóa theo `SupportAllowanceColumnApi.code`. */
export interface SupportAllowanceItemApi {
  ma_nv: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  positionName: string;
  contractType: string | null;
  salaryType: string | null;
  actualWorkDays: number;
  standardWorkDays: number;
  /** Mọi code có mặt trong `columns` đều có mặt ở đây (0 nếu không được gán) — không cần `?? 0`. */
  amounts: Record<string, number>;
  /** Σ mức tháng, CHƯA quy đổi công. */
  monthlyTotal: number;
  /** Σ sau quy đổi công — con số phải khớp phần BENEFIT_ALLOWANCE trong `allowanceInPeriodTotal`. */
  total: number;
}

export interface SupportAllowanceResponseApi {
  periodId: string;
  periodStatus: string;
  /**
   * Luôn `true` — endpoint này luôn tính LIVE, không đọc snapshot đóng băng (RVW-020). Với kỳ đã
   * khóa, số ở đây có thể lệch với `/payroll/sheet-lines` nếu có ai sửa mức phụ cấp sau khi khóa
   * sổ — FE có thể dùng cờ này để cảnh báo, hiện chưa hiển thị riêng (xem dev-notes.md).
   */
  isLiveRecalculated: boolean;
  standardWorkDays: number;
  columns: SupportAllowanceColumnApi[];
  items: SupportAllowanceItemApi[];
}

/** `GET /payroll/calculate?periodId=` — bảng lương chính, luôn tính LIVE bất kể trạng thái kỳ. */
export function getPayrollCalculate(periodId: string): Promise<PayrollCalculationLineApi[]> {
  return api.get<PayrollCalculationLineApi[]>(`${BASE}/calculate`, { params: { periodId } });
}

/** `GET /payroll/support-allowances?periodId=` — tab "Lương hỗ trợ" (endpoint MỚI, api-contract 8.2). */
export function getSupportAllowances(periodId: string): Promise<SupportAllowanceResponseApi> {
  return api.get<SupportAllowanceResponseApi>(`${BASE}/support-allowances`, {
    params: { periodId },
  });
}

/**
 * A-06 (review-findings.md · api-contract Mục 0.3, nợ kỹ thuật CHƯA đóng ở `be_maxv`): nhánh
 * snapshot của `/payroll/sheet-lines` (kỳ LOCKED trở lên) đọc thẳng cột `Decimal` Prisma từ
 * `PayrollSheetLine` — `Decimal.prototype.toJSON()` trả CHUỖI, khác nhánh live
 * (`calculatePayrollPreview` đã `Number(...)` mọi trường trước khi trả JSON số thật). Cùng
 * endpoint, cùng kiểu khai báo `PayrollCalculationLineApi`, nhưng RUNTIME đổi kiểu giữa hai nhánh
 * — không có lỗi nào được ném, chỉ có bug âm thầm (`"1000000" + "500000"` nối chuỗi thành
 * `"1000000500000"` thay vì cộng số) nếu tin thẳng kiểu khai báo. Liệt kê đủ mọi trường `Decimal`
 * (loại trừ `string`/`boolean`/`ma_nv`…) để ép `Number(...)` ngay tại biên response — lớp
 * `bangLuongQueries.ts` phía sau được PHÉP tin `number` thật cho cả hai nhánh.
 */
const PAYROLL_LINE_NUMERIC_FIELDS = [
  "dependentCount",
  "contractBaseSalary",
  "fixedAllowanceTotal",
  "baseSalaryMonthly",
  "allowanceInPeriodTotal",
  "standardWorkDays",
  "actualWorkDays",
  "otRawHours",
  "otConvertedHours",
  "proratedWorkSalary",
  "otAmount",
  "pieceworkSalary",
  "bonusSalary",
  "kpiSalary",
  "commissionSalary",
  "diligenceSalary",
  "grossIncome",
  "otTaxExemptAmount",
  "mealAllowanceAmount",
  "lunchAllowanceExemptAmount",
  "lunchAllowanceTaxableAmount",
  "otherAllowanceTaxExemptAmount",
  "insuranceSalaryBase",
  "insuranceBaseBhxhByt",
  "insuranceBaseBhtn",
  "employeeInsuranceDeduction",
  "companyInsuranceExpense",
  "employeeUnionFee",
  "companyUnionExpense",
  "taxableIncome",
  "personalIncomeTax",
  "adjustmentNetAmount",
  "netTakeHomeSalary",
  "totalCompanyCost",
] as const satisfies readonly (keyof PayrollCalculationLineApi)[];

let daCanhBaoTruongThieu = false;

function normalizePayrollLine(raw: Record<string, unknown>): PayrollCalculationLineApi {
  const line = { ...raw } as unknown as Record<string, unknown>;
  for (const field of PAYROLL_LINE_NUMERIC_FIELDS) {
    const v = Number(raw[field] ?? 0);
    if (!Number.isFinite(v) && !daCanhBaoTruongThieu) {
      daCanhBaoTruongThieu = true;
      console.warn(`[payrollCalculationApi] trường "${field}" không phải số hợp lệ, đã fallback về 0`);
    }
    line[field] = Number.isFinite(v) ? v : 0;
  }
  return line as unknown as PayrollCalculationLineApi;
}

/**
 * `GET /payroll/sheet-lines?periodId=` — kỳ DRAFT/PENDING_REVIEW trả tính toán live (giống
 * `/payroll/calculate`), kỳ đã khóa (LOCKED/APPROVED/PAID/ARCHIVED) trả snapshot đóng băng lúc
 * khóa sổ (`payrollCalculation.service.ts::getPayrollSheetLines`, be_maxv). Đã ép kiểu Decimal
 * (A-06, xem `normalizePayrollLine` ở trên) trước khi trả cho FE — bên gọi không cần tự lo runtime
 * type nữa.
 */
export async function getPayrollSheetLines(periodId: string): Promise<PayrollCalculationLineApi[]> {
  const rows = await api.get<Record<string, unknown>[]>(`${BASE}/sheet-lines`, {
    params: { periodId },
  });
  return rows.map(normalizePayrollLine);
}

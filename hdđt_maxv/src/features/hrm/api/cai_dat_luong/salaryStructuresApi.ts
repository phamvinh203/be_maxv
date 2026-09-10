import { api } from "@/lib/apiClient";

const BASE = "/hrm/salary-structures";

export type TaxTreatmentApi = "TAXABLE" | "EXEMPT";

export type CalculationMethodApi =
  | "MONTHLY_FIXED"
  | "ACTUAL_WORKDAYS"
  | "HOURLY"
  | "OUTPUT_BASED"
  | "REVENUE_PERCENTAGE"
  | "KPI_BASED"
  | "MANUAL_ENTRY";

export interface SalaryStructureItemApi {
  id: string;
  salaryStructureId: string;
  salaryItemId: string;
  taxTreatment: TaxTreatmentApi;
  isOvertimeBase: boolean;
  calculationMethod: CalculationMethodApi;
  defaultAmount: number;
  /** Mã khoản (`hrm_salary_items.code`) — máy chủ ghép sẵn từ `salaryItem.code`. */
  ma_khoan: string;
}

export interface SalaryStructureApi {
  id: string;
  /** `YYYY-MM-DD`. */
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  isActive: boolean;
  items: SalaryStructureItemApi[];
}

export interface SaveSalaryStructureItemApiBody {
  salaryItemId: string;
  taxTreatment: TaxTreatmentApi;
  isOvertimeBase: boolean;
  calculationMethod: CalculationMethodApi;
  defaultAmount: number;
}

export interface SaveSalaryStructureApiBody {
  /** `YYYY-MM-DD`. */
  effectiveFrom: string;
  effectiveTo?: string | null;
  note?: string | null;
  items: SaveSalaryStructureItemApiBody[];
}

/**
 * Công ty chỉ có MỘT cấu trúc lương khung đang áp dụng — route thật là
 * `GET/PUT /salary-structures/current`, không phải danh sách nhiều cấu trúc như bản nháp cũ
 * của `api-contract-cai-dat-luong.md`. Trả `null` khi công ty chưa từng lưu cấu trúc nào.
 */
export function getCurrentSalaryStructure(): Promise<SalaryStructureApi | null> {
  return api.get<SalaryStructureApi | null>(`${BASE}/current`);
}

/** Lưu đè cấu trúc khung hiện hành (tạo mới nếu chưa có bản nào). */
export function saveSalaryStructure(
  body: SaveSalaryStructureApiBody,
): Promise<SalaryStructureApi> {
  return api.put<SalaryStructureApi>(`${BASE}/current`, body);
}

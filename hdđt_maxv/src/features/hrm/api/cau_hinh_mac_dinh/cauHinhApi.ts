import { api } from "@/lib/apiClient";

/** Gọi API cấu hình mặc định HRM (`hrm_general_settings`, singleton `id = "DEFAULT"`). */
const BASE = "/hrm/settings/general";

/**
 * Một bậc của biểu thuế trên đường truyền.
 *
 * `khoang` là **ngưỡng trên lũy kế** (BR-hrm-080), KHÔNG phải độ rộng bậc. `null` là **bậc mở**
 * — chỉ hợp lệ và bắt buộc ở phần tử cuối (ADR-009 QĐ 1). Gửi `0` bị máy chủ từ chối 400.
 *
 * Cột `taxBrackets` là `Json`, KHÔNG phải `Decimal`, nên hai số bên trong đi ra JSON là **số
 * thật** — khác 20 cột `Decimal` bên dưới. Đừng `Number()` nhầm cả cụm.
 */
export interface TaxBracketApiItem {
  khoang: number | null;
  thueSuat: number;
}

export type WorkDayMethodApi = "FIXED_26" | "FIXED_24" | "ACTUAL_MONTH";
export type DayPolicyApi = "FULL_DAY" | "HALF_DAY" | "OFF";

/**
 * Bản ghi máy chủ trả về (`GET`, và thân phản hồi của `PUT` / `restore-default`).
 *
 * 🔴 **20 trường `Decimal` là CHUỖI, không phải số.** Prisma trả `Prisma.Decimal`, ba route
 * này không khai `response schema` nên Fastify dùng `JSON.stringify` và `Decimal.toJSON()`
 * trả chuỗi: `new Prisma.Decimal('8.00')` ra `"8"` (số 0 thừa bị chuẩn hóa mất). Bắt buộc
 * `Number()` ở adapter — quên là mọi phép cộng lương biến thành nối chuỗi, và gửi lại nguyên
 * si payload vừa nhận thì Zod chiều ghi trả **400 "Expected number, received string"**.
 * Cùng khuôn mẫu với `hopDongApi.ts` (`luong_chinh: string`). Nguồn: api-contract Mục 7D.0 (a).
 *
 * 5 trường `Int` và `taxBrackets` thì ra **số thật** — đừng ép kiểu ngược lại.
 */
export interface GeneralSettingApiData {
  id: string;

  // Ba enum + hai mốc thời gian — chuỗi ở cả hai chiều.
  standardWorkingDaysMethod: WorkDayMethodApi;
  saturdayPolicy: DayPolicyApi;
  sundayPolicy: DayPolicyApi;

  // ── 20 cột Decimal: ĐỌC VỀ LÀ CHUỖI ──
  standardHoursPerDay: string;
  otRateWeekdayDay: string;
  otRateWeekdayNight: string;
  otRateWeekendDay: string;
  otRateWeekendNight: string;
  otRateHolidayDay: string;
  otRateHolidayNight: string;
  baseSalary: string;
  regionMinSalary: string;
  insuranceEmployeeSocial: string;
  insuranceEmployeeHealth: string;
  insuranceEmployeeUnemployment: string;
  insuranceCompanySocial: string;
  insuranceCompanyHealth: string;
  insuranceCompanyUnemployment: string;
  unionFeeEmployeeRate: string;
  unionFeeMaxAmount: string;
  unionFeeCompanyRate: string;
  personalDeduction: string;
  dependentDeduction: string;

  // ── 3 tham số pháp lý mới (ADR-010): trần miễn thuế ăn trưa + khấu trừ tại nguồn HĐ
  //    thử việc/thời vụ — cũng là cột Decimal, cùng khuôn 20 cột trên ──
  lunchAllowanceTaxFreeCap: string;
  withholdingTaxRate: string;
  withholdingTaxThreshold: string;

  // ── 5 cột Int: số thật ──
  baseAnnualLeaveDays: number;
  seniorityYearsForExtraDay: number;
  maxOtHoursPerMonth: number;
  warningOtHoursPerYear: number;
  maxOtHoursPerYear: number;

  taxBrackets: TaxBracketApiItem[];

  /**
   * Cảnh báo cấp gốc của `data`, **chỉ có ở phản hồi `PUT`** và chỉ khi biểu thuế vừa lưu
   * khác biểu chuẩn 7 bậc: `"CANH_BAO_BIEU_THUE_LECH_CHUAN"` (BR-hrm-083). Không đổi mã HTTP,
   * không chặn lưu. Trùng khớp biểu chuẩn hoặc không gửi `taxBrackets` thì **vắng mặt hẳn**.
   */
  warning?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * Thân request `PUT` — **chiều ghi khai `number`**, ngược với chiều đọc.
 *
 * Bất đối xứng này là **có chủ ý** (ADR-009 QĐ 3): giữ chuỗi ở chiều đọc để không mất chính xác
 * trên dữ liệu tiền, còn Zod chiều ghi là `z.number()` nên gửi chuỗi là 400.
 *
 * Cố ý KHÔNG dùng `Partial<Omit<GeneralSettingApiData, ...>>`: kiểu đó thừa hưởng nhầm `string`
 * của chiều đọc sang chiều ghi — đúng cái lỗi làm màn Cấu hình không lưu được (`FE-02`).
 */
export interface UpdateGeneralSettingsApiBody {
  standardWorkingDaysMethod?: WorkDayMethodApi;
  saturdayPolicy?: DayPolicyApi;
  sundayPolicy?: DayPolicyApi;

  standardHoursPerDay?: number;
  otRateWeekdayDay?: number;
  otRateWeekdayNight?: number;
  otRateWeekendDay?: number;
  otRateWeekendNight?: number;
  otRateHolidayDay?: number;
  otRateHolidayNight?: number;
  baseSalary?: number;
  regionMinSalary?: number;
  insuranceEmployeeSocial?: number;
  insuranceEmployeeHealth?: number;
  insuranceEmployeeUnemployment?: number;
  insuranceCompanySocial?: number;
  insuranceCompanyHealth?: number;
  insuranceCompanyUnemployment?: number;
  unionFeeEmployeeRate?: number;
  unionFeeMaxAmount?: number;
  unionFeeCompanyRate?: number;
  personalDeduction?: number;
  dependentDeduction?: number;

  lunchAllowanceTaxFreeCap?: number;
  withholdingTaxRate?: number;
  withholdingTaxThreshold?: number;

  baseAnnualLeaveDays?: number;
  seniorityYearsForExtraDay?: number;
  maxOtHoursPerMonth?: number;
  warningOtHoursPerYear?: number;
  maxOtHoursPerYear?: number;

  taxBrackets?: TaxBracketApiItem[];
}

/**
 * Lần gọi ĐẦU TIÊN của mỗi công ty sẽ **ghi vào DB** (self-healing tạo bản ghi chuẩn) — đó là
 * điều một `GET` bình thường không làm. Hai tab mở cùng lúc trên công ty trắng có thể nhận 409.
 */
export function getGeneralSettings(): Promise<GeneralSettingApiData> {
  return api.get<GeneralSettingApiData>(BASE);
}

/** Cập nhật một phần — trả về **toàn bộ** bản ghi sau khi cập nhật, không phải các trường vừa đổi. */
export function updateGeneralSettings(
  body: UpdateGeneralSettingsApiBody,
): Promise<GeneralSettingApiData> {
  return api.put<GeneralSettingApiData>(BASE, body);
}

/**
 * Ghi đè toàn bộ tham số về bộ chuẩn pháp luật VN, **không hoàn tác được** — kể cả biểu thuế
 * công ty tự đặt. Giao diện bắt buộc hỏi xác nhận nêu rõ điều đó (FR-hrm-047).
 */
export function restoreDefaultSettings(): Promise<GeneralSettingApiData> {
  return api.post<GeneralSettingApiData>(`${BASE}/restore-default`);
}

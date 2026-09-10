import { z } from 'zod';
import { MESSAGES } from '../../../constants/messages';

/**
 * MỘT BẬC CỦA BIỂU THUẾ TNCN LŨY TIẾN TỪNG PHẦN.
 *
 * `khoang` = **NGƯỠNG TRÊN LŨY KẾ** của thu nhập tính thuế trong tháng — mốc mà bậc đó áp đến.
 * KHÔNG phải độ rộng bậc. Nghĩa này là một và duy nhất trên toàn tuyến (lưu trữ · API · ô nhập
 * trên giao diện); cấm mọi hình thức quy đổi ngầm — BR-hrm-080 (BA chốt QĐ #24).
 *
 * `khoang: null` = **BẬC MỞ**: không có ngưỡng trên, áp cho toàn bộ phần thu nhập vượt ngưỡng của
 * bậc liền trước. Chỉ hợp lệ ở phần tử CUỐI, và phần tử cuối BẮT BUỘC là `null`
 * (ADR-009 Quyết định 1, `api-contract.md` Mục 7D.0 (b)).
 */
export interface TaxBracketItem {
  khoang: number | null;
  thueSuat: number;
}

/**
 * Mốc số mà bản cũ dùng để diễn đạt "vô hạn" trước ADR-009.
 *
 * CỬA SỔ TƯƠNG THÍCH NGƯỢC — CÓ HẠN. Chiều ghi chấp nhận `khoang >= MOC_TUONG_THICH_BAC_MO` ở
 * phần tử cuối và chuẩn hóa về `null` TRƯỚC KHI LƯU; chiều đọc luôn trả `null`. Không có cửa này
 * thì một công ty đang giữ biểu cũ chỉ cần mở màn Cấu hình rồi bấm Lưu là ăn 400 `E-hrm-082` —
 * Frontend gửi lại nguyên biểu vừa nhận, kể cả mốc.
 *
 * ⚠️ Cửa sổ ĐÓNG khi thao tác chuẩn hóa `FR-hrm-055` (`npm run hrm:chuan-hoa-thue`) chạy xong
 * trên toàn bộ công ty. Để mở vĩnh viễn là tạo ra nghĩa thứ hai cho cùng một trường — đúng thứ
 * BR-hrm-080 cấm. Gỡ nhánh này là việc của đợt dọn sau khi đối soát script cho `cầnXemLai = 0`.
 */
export const MOC_TUONG_THICH_BAC_MO = 999999999999;

/**
 * BR-hrm-073 / `BR-hrm-082` điều kiện 3 — thuế suất tăng NGHIÊM NGẶT theo chỉ số.
 * Chỉ kiểm cột `thueSuat`; ba điều kiện còn lại nằm ở `soatToanVenBieuThue`.
 */
export function soatThueLuyTien(brackets?: TaxBracketItem[]): boolean {
  if (!brackets || brackets.length <= 1) return true;
  for (let i = 1; i < brackets.length; i++) {
    if (brackets[i].thueSuat <= brackets[i - 1].thueSuat) {
      return false;
    }
  }
  return true;
}

/**
 * Chuẩn hóa bậc mở: mốc số cũ ở phần tử CUỐI -> `null`. Xem `MOC_TUONG_THICH_BAC_MO`.
 * Mốc số nằm ở vị trí KHÁC không được đụng tới — ở đó nó là một ngưỡng hữu hạn bình thường và
 * phải chịu phép kiểm ngưỡng tăng dần như mọi bậc khác.
 */
export function chuanHoaBacMo(brackets: TaxBracketItem[]): TaxBracketItem[] {
  if (brackets.length === 0) return brackets;
  const cuoi = brackets[brackets.length - 1];
  if (cuoi.khoang !== null && cuoi.khoang >= MOC_TUONG_THICH_BAC_MO) {
    return [...brackets.slice(0, -1), { ...cuoi, khoang: null }];
  }
  return brackets;
}

/**
 * BỐN ĐIỀU KIỆN TOÀN VẸN BIỂU THUẾ — BR-hrm-082, kiểm TRỌN KHỐI.
 * Hễ nội dung gửi lên *có chứa* `taxBrackets` thì cả mảng bị kiểm đủ bốn điều kiện; không gửi
 * thì không kiểm. Trả về thông điệp của vi phạm ĐẦU TIÊN, `null` khi biểu hợp lệ.
 *
 * | # | Điều kiện                                   | Mã lỗi     |
 * |---|---------------------------------------------|------------|
 * | 1 | Tối thiểu 2 bậc                             | E-hrm-081  |
 * | 2 | Ngưỡng lũy kế tăng nghiêm ngặt              | E-hrm-080  |
 * | 3 | Thuế suất tăng nghiêm ngặt (BR-hrm-073)     | E-hrm-069  |
 * | 4 | Bậc cuối là bậc mở (`khoang === null`)      | E-hrm-082  |
 *
 * THỨ TỰ KIỂM là có chủ đích, không tùy tiện:
 *   • `null` ở vị trí không phải cuối được bắt TRƯỚC phép so ngưỡng — không thì phép so phải
 *     đối chiếu với `null` và cho ra kết quả vô nghĩa.
 *   • Ngưỡng (đk 2) kiểm TRƯỚC "bậc cuối phải mở" (đk 4), và so cả cặp cuối khi cặp đó vẫn là
 *     số. Lý do: một biểu vừa lộn xộn ngưỡng vừa thiếu bậc mở thì lỗi đáng nói với người dùng là
 *     ngưỡng lộn xộn (AC-hrm-68 nêu đích danh ví dụ `10.000.000` rồi `8.000.000` và kỳ vọng
 *     `E-hrm-080`). Không nới lỏng gì: biểu có bậc cuối hữu hạn vẫn bị từ chối, chỉ là bằng mã
 *     khác khi nó còn một lỗi nặng hơn.
 */
export function soatToanVenBieuThue(brackets: TaxBracketItem[]): string | null {
  // Điều kiện 1 — tối thiểu 2 bậc. Một bậc duy nhất là thuế suất phẳng, không phải lũy tiến.
  if (brackets.length < 2) {
    return MESSAGES.HRM.BIEU_THUE_TOI_THIEU_2_BAC;
  }

  const chiSoCuoi = brackets.length - 1;

  // Điều kiện 4 (phần vị trí) — `null` chỉ được phép ở phần tử cuối.
  for (let i = 0; i < chiSoCuoi; i++) {
    if (brackets[i].khoang === null) {
      return MESSAGES.HRM.BAC_THUE_CUOI_PHAI_MO;
    }
  }

  // Điều kiện 2 — ngưỡng lũy kế tăng nghiêm ngặt trên mọi cặp liền kề còn là SỐ.
  for (let i = 1; i < brackets.length; i++) {
    const truoc = brackets[i - 1].khoang;
    const sau = brackets[i].khoang;
    if (truoc !== null && sau !== null && sau <= truoc) {
      return MESSAGES.HRM.NGUONG_THUE_KHONG_TANG;
    }
  }

  // Điều kiện 3 — thuế suất tăng nghiêm ngặt.
  if (!soatThueLuyTien(brackets)) {
    return MESSAGES.HRM.THUE_TNCN_KHONG_LUY_TIEN;
  }

  // Điều kiện 4 (phần bậc cuối) — bậc cuối bắt buộc là bậc mở, không để hở khoảng thu nhập nào.
  if (brackets[chiSoCuoi].khoang !== null) {
    return MESSAGES.HRM.BAC_THUE_CUOI_PHAI_MO;
  }

  return null;
}

const taxBracketSchema = z.object({
  // `.int()` theo `api-contract.md` Mục 7D.0 (b): ngưỡng là số nguyên dương. `0` KHÔNG mang nghĩa
  // "bậc cuối" hay "vô hạn" ở bất kỳ đâu (BR-hrm-080) nên `positive()` giữ nguyên và luôn chặn nó.
  khoang: z.number().int().positive().nullable(),
  thueSuat: z.number().min(0).max(100),
});

export const updateGeneralSettingsSchema = z
  .object({
    standardWorkingDaysMethod: z.enum(['FIXED_26', 'FIXED_24', 'ACTUAL_MONTH']).optional(),
    saturdayPolicy: z.enum(['FULL_DAY', 'HALF_DAY', 'OFF']).optional(),
    sundayPolicy: z.enum(['FULL_DAY', 'HALF_DAY', 'OFF']).optional(),
    standardHoursPerDay: z.number().optional(),
    baseAnnualLeaveDays: z.number().int().min(0).optional(),
    seniorityYearsForExtraDay: z.number().int().min(1).optional(),
    otRateWeekdayDay: z.number().min(0).optional(),
    otRateWeekdayNight: z.number().min(0).optional(),
    otRateWeekendDay: z.number().min(0).optional(),
    otRateWeekendNight: z.number().min(0).optional(),
    otRateHolidayDay: z.number().min(0).optional(),
    otRateHolidayNight: z.number().min(0).optional(),
    maxOtHoursPerMonth: z.number().int().min(0).optional(),
    warningOtHoursPerYear: z.number().int().min(0).optional(),
    maxOtHoursPerYear: z.number().int().min(0).optional(),
    baseSalary: z.number().optional(),
    regionMinSalary: z.number().optional(),
    insuranceEmployeeSocial: z.number().min(0).max(100).optional(),
    insuranceEmployeeHealth: z.number().min(0).max(100).optional(),
    insuranceEmployeeUnemployment: z.number().min(0).max(100).optional(),
    insuranceCompanySocial: z.number().min(0).max(100).optional(),
    insuranceCompanyHealth: z.number().min(0).max(100).optional(),
    insuranceCompanyUnemployment: z.number().min(0).max(100).optional(),
    unionFeeEmployeeRate: z.number().min(0).max(100).optional(),
    unionFeeMaxAmount: z.number().min(0).optional(),
    unionFeeCompanyRate: z.number().min(0).max(100).optional(),
    personalDeduction: z.number().min(0).optional(),
    dependentDeduction: z.number().min(0).optional(),
    // ADR-010 QĐ-2 (2026-09-10) — 3 tham số mới cho Bảng lương tổng hợp (BR-dltl-026/027).
    // Thẩm định `E-hrm-083`: `data-model-du-lieu-tinh-luong.md` Mục 11.2.
    lunchAllowanceTaxFreeCap: z.number().min(0).optional(),
    withholdingTaxRate: z.number().min(0).max(100).optional(),
    withholdingTaxThreshold: z.number().min(0).optional(),
    // Chuẩn hóa mốc-số-cũ -> `null` NGAY Ở TẦNG TRƯỜNG, tức là TRƯỚC `superRefine` bên dưới.
    // Nhờ vậy bốn điều kiện toàn vẹn chỉ phải biết đúng một cách mã hóa bậc mở, và giá trị đi
    // xuống service (rồi xuống DB) cũng đã là dạng chuẩn — không ai phải chuẩn hóa lần hai.
    taxBrackets: z.array(taxBracketSchema).transform(chuanHoaBacMo).optional(),
  })
  .superRefine((data, ctx) => {
    // E-hrm-067: Giờ công chuẩn/ngày phải từ 1.0 đến 24.0
    if (data.standardHoursPerDay !== undefined) {
      if (data.standardHoursPerDay < 1.0 || data.standardHoursPerDay > 24.0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['standardHoursPerDay'],
          message: MESSAGES.HRM.GIO_CONG_CHUAN_INVALID,
        });
      }
    }

    // E-hrm-068: Lương cơ sở và lương tối thiểu vùng phải là số nguyên > 0
    if (data.baseSalary !== undefined) {
      if (!Number.isInteger(data.baseSalary) || data.baseSalary <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['baseSalary'],
          message: MESSAGES.HRM.LUONG_CO_SO_HOAC_VUNG_INVALID,
        });
      }
    }

    if (data.regionMinSalary !== undefined) {
      if (!Number.isInteger(data.regionMinSalary) || data.regionMinSalary <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['regionMinSalary'],
          message: MESSAGES.HRM.LUONG_CO_SO_HOAC_VUNG_INVALID,
        });
      }
    }

    // E-hrm-069 / E-hrm-080 / E-hrm-081 / E-hrm-082 — bốn điều kiện BR-hrm-082, kiểm trọn khối.
    if (data.taxBrackets !== undefined) {
      const viPham = soatToanVenBieuThue(data.taxBrackets);
      if (viPham) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['taxBrackets'],
          message: viPham,
        });
      }
    }
  });

export type UpdateGeneralSettingsInput = z.infer<typeof updateGeneralSettingsSchema>;

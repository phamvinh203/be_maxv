import type { Prisma } from '../../../generated/tenant';
import {
  BIEU_THUE_7_BAC_CU,
  BIEU_THUE_CHUAN_5_BAC,
} from '../../../services/client/hrm/cau_hinh_mac_dinh/generalSettings.service';
import type { TaxBracketItem } from '../../../validators/hrm/cau_hinh_mac_dinh/generalSettings.validator';

/**
 * DỮ LIỆU KHỞI TẠO cho cụm thuế TNCN — `data-model-to-khai-thue.md` Mục 7.
 *
 * Đặt ở constants dùng chung vì có HAI nơi tiêu thụ và chúng KHÔNG được lệch nhau:
 *   1. Script di trú M-2 (`scripts/hrm/seed-chinh-sach-thue.ts`) — nạp cho tenant đã có sẵn.
 *   2. Seed lười khi bảng rỗng — danh mục theo `AC-tkt-003` (`incomeCategory.service.ts`) và chính sách thuế
 *      (`taxPolicy.service.ts`, RVW-725), cùng khuôn self-healing `BR-hrm-070`.
 * Chép bộ số này sang chỗ thứ ba là tạo nguồn sự thật thứ hai — đúng lỗi đã mắc với biểu thuế.
 */

export interface ChinhSachThueSeed {
  effectiveFrom: string; // YYYY-MM-DD
  personalDeduction: number;
  dependentDeduction: number;
  taxBrackets: TaxBracketItem[];
  withholdingTaxRate: number;
  withholdingTaxThreshold: number;
  voluntaryPensionMonthlyCap: number;
  lunchAllowanceTaxFreeCap: number;
  legalBasisNote: string;
}

/**
 * Một mốc seed → dữ liệu ghi `hrm_tax_policies`. MỘT phép ánh xạ cho script M-2, nạp lười và bộ kiểm thử (RVW-734):
 * thêm cột chính sách mà quên một bản chép thì công ty cấp mới âm thầm nhận giá trị mặc định của cột.
 */
export function veDuLieuChinhSach(
  cs: ChinhSachThueSeed,
): Prisma.TaxPolicyCreateManyInput {
  return {
    effectiveFrom: new Date(`${cs.effectiveFrom}T00:00:00.000Z`),
    personalDeduction: cs.personalDeduction,
    dependentDeduction: cs.dependentDeduction,
    taxBrackets: cs.taxBrackets as unknown as Prisma.InputJsonValue,
    withholdingTaxRate: cs.withholdingTaxRate,
    withholdingTaxThreshold: cs.withholdingTaxThreshold,
    voluntaryPensionMonthlyCap: cs.voluntaryPensionMonthlyCap,
    lunchAllowanceTaxFreeCap: cs.lunchAllowanceTaxFreeCap,
    legalBasisNote: cs.legalBasisNote,
  };
}

/**
 * Hai mốc hiệu lực (Mục 7.1).
 *
 * Dòng `1900-01-01` là **ảnh chụp hiện trạng**, KHÔNG phải giá trị "đúng": chép đúng bộ số mà
 * `GeneralSetting` và `tinhThueLuyTien()` đang chạy trước 2026, để mọi kỳ đã chốt trong quá khứ
 * tính lại vẫn ra đúng số cũ (A-tkt-01). Cấm "sửa cho đẹp" bộ số dòng này.
 *
 * `OQ-tkt-02` đã CHỐT 2026-09-14: áp biểu mới cho TOÀN BỘ năm 2026, không tách H1/H2 — nên đúng
 * hai dòng, mốc `2026-01-01`. Nếu cơ quan thuế hướng dẫn khác, mô hình hiệu lực-theo-mốc cho
 * phép sửa bằng MỘT dòng dữ liệu (đổi mốc thành `2026-07-01` + thêm dòng H1), không đụng code.
 */
export const CHINH_SACH_THUE_SEED: ChinhSachThueSeed[] = [
  {
    effectiveFrom: '1900-01-01',
    personalDeduction: 11_000_000,
    dependentDeduction: 4_400_000,
    taxBrackets: BIEU_THUE_7_BAC_CU.map((b) => ({ ...b })),
    withholdingTaxRate: 10.0,
    withholdingTaxThreshold: 2_000_000,
    voluntaryPensionMonthlyCap: 1_000_000,
    lunchAllowanceTaxFreeCap: 730_000,
    legalBasisNote:
      'Ảnh chụp hiện trạng trước kỳ tính thuế 2026: Điều 22 Luật Thuế TNCN 04/2007/QH12 (sửa bởi 26/2012/QH13), NQ 954/2020/UBTVQH14, TT 111/2013/TT-BTC, TT 26/2016/TT-BLĐTBXH.',
  },
  {
    effectiveFrom: '2026-01-01',
    personalDeduction: 15_500_000,
    dependentDeduction: 6_200_000,
    taxBrackets: BIEU_THUE_CHUAN_5_BAC.map((b) => ({ ...b })),
    withholdingTaxRate: 10.0,
    withholdingTaxThreshold: 5_000_000,
    voluntaryPensionMonthlyCap: 3_000_000,
    lunchAllowanceTaxFreeCap: 1_200_000,
    legalBasisNote:
      'Luật Thuế TNCN 109/2025/QH15 (sửa bởi 09/2026/QH16), NĐ 253/2026/NĐ-CP, NQ 110/2025/UBTVQH15, TT 87/2026/TT-BTC và 89/2026/TT-BTC. Hiệu lực từ kỳ tính thuế 2026.',
  },
];

export interface DanhMucThuNhapSeed {
  code: string;
  name: string;
  taxTreatmentGroup:
    'EXEMPT_FULL' | 'EXEMPT_CAPPED' | 'TAXABLE_FULL' | 'WITHHOLDING_FLAT';
  exemptCapAmount?: number;
  exemptCapPeriod?: 'MONTHLY' | 'YEARLY';
  withholdingRate?: number;
  withholdingThreshold?: number;
}

/**
 * 12 danh mục loại thu nhập ngoài lương (Mục 7.2, nguyên văn số liệu SRS BR-tkt-002).
 *
 * Bốn tham số thuế để `undefined` có chủ đích với nhóm không dùng tới: `NULL` nghĩa là "nhóm này
 * không áp dụng tham số đó". KHÔNG dùng `0` — `0` là một ngưỡng hợp lệ (khấu trừ từ đồng đầu tiên).
 */
export const DANH_MUC_THU_NHAP_SEED: DanhMucThuNhapSeed[] = [
  {
    code: 'TN01',
    name: 'Làm thêm giờ / ca đêm',
    taxTreatmentGroup: 'EXEMPT_FULL',
  },
  {
    code: 'TN02',
    name: 'Trợ cấp thôi việc / mất việc',
    taxTreatmentGroup: 'EXEMPT_FULL',
  },
  {
    code: 'TN03',
    name: 'Trợ cấp thất nghiệp',
    taxTreatmentGroup: 'EXEMPT_FULL',
  },
  {
    code: 'TN04',
    name: 'Công tác phí thực thanh toán có chứng từ',
    taxTreatmentGroup: 'EXEMPT_FULL',
  },
  {
    code: 'TN05',
    name: 'Khoản chi chung không ghi tên cá nhân (xe đưa đón, học phí con, khám sức khỏe)',
    taxTreatmentGroup: 'EXEMPT_FULL',
  },
  {
    code: 'TN06',
    name: 'Trang phục hiện vật có hóa đơn',
    taxTreatmentGroup: 'EXEMPT_FULL',
  },
  {
    code: 'TN07',
    name: 'Thưởng sáng kiến được cơ quan nhà nước công nhận',
    taxTreatmentGroup: 'EXEMPT_FULL',
  },
  {
    // BA duyệt chuyển từ EXEMPT_CAPPED sang EXEMPT_FULL (phản biện P-09): nhóm miễn-toàn-bộ đã
    // cho đúng kết quả, không cần khái niệm "trần vô hạn" tự mâu thuẫn với BR-tkt-003.
    code: 'TN08',
    name: 'Ăn ca doanh nghiệp tự nấu / phiếu ăn',
    taxTreatmentGroup: 'EXEMPT_FULL',
  },
  {
    code: 'TN09',
    name: 'Ăn trưa / ăn ca bằng tiền mặt',
    taxTreatmentGroup: 'EXEMPT_CAPPED',
    exemptCapAmount: 1_200_000,
    exemptCapPeriod: 'MONTHLY',
  },
  {
    // `OQ-tkt-03` còn mở: 5.000.000/năm là mức kế thừa TT 111/2013, chưa xác nhận lại theo
    // TT 87/2026. Kế toán sửa được trên màn danh mục nên không chặn triển khai.
    code: 'TN10',
    name: 'Trang phục bằng tiền',
    taxTreatmentGroup: 'EXEMPT_CAPPED',
    exemptCapAmount: 5_000_000,
    exemptCapPeriod: 'YEARLY',
  },
  {
    code: 'TN11',
    name: 'Thưởng Tết / lễ / KPI / tháng 13 · phúc lợi ghi rõ tên cá nhân',
    taxTreatmentGroup: 'TAXABLE_FULL',
  },
  {
    code: 'TN12',
    name: 'Hoa hồng / thù lao CTV / kiêm nhiệm không HĐLĐ hoặc HĐLĐ <3 tháng',
    taxTreatmentGroup: 'WITHHOLDING_FLAT',
    withholdingRate: 10.0,
    withholdingThreshold: 5_000_000,
  },
];

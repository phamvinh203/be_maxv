/**
 * MÃ CẢNH BÁO NGHIỆP VỤ CỦA PHÂN HỆ HRM — trường `warning` trong thân phản hồi.
 *
 * Cảnh báo KHÁC lỗi ở ba điểm, và đó là lý do chúng không nằm trong `MESSAGES`:
 *   1. Không đổi mã HTTP (vẫn 200/201) và KHÔNG chặn lưu.
 *   2. Là **mã máy đọc được**, không phải câu tiếng Việt — giao diện tự chọn wording, thêm loại
 *      cảnh báo mới sau này không phải dò câu chữ.
 *   3. Vắng mặt hẳn khỏi payload khi không có gì để cảnh báo (không trả `null`, không chuỗi rỗng).
 *
 * Căn cứ: `docs/hrm/architecture/adr/ADR-009-...md` Quyết định 4 (ca > 12h) và BR-hrm-083
 * (biểu thuế lệch chuẩn); bảng liệt kê ở `api-contract.md` Mục 8.11 phần "Cảnh báo".
 */
export const HRM_CANH_BAO = {
  /**
   * Ca làm việc có `workingHours > 12.0` — Điều 105 & 107 BLLĐ 2019 (giờ bình thường ≤ 8h/ngày;
   * bình thường + làm thêm ≤ 12h/ngày). VẪN LƯU để phục vụ ca trực y tế / an ninh / cứu hộ
   * (BR-hrm-076, FR-hrm-048, AC-hrm-63).
   */
  GIO_LAM_VUOT_TRAN_BLLD: 'CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD',

  /**
   * Biểu thuế TNCN vừa lưu KHÁC biểu chuẩn 7 bậc Điều 22 Luật Thuế TNCN (khác số bậc, hoặc khác
   * bất kỳ cặp ngưỡng–thuế suất nào). VẪN LƯU vì pháp luật đổi biểu thuế thì công ty phải chỉnh
   * được ngay, không chờ bản phát hành mới (BR-hrm-083, AC-hrm-70).
   */
  BIEU_THUE_LECH_CHUAN: 'CANH_BAO_BIEU_THUE_LECH_CHUAN',
} as const;

/** Ngưỡng giờ công một ca vượt quá thì sinh cảnh báo — Điều 105 & 107 BLLĐ 2019. */
export const NGUONG_GIO_CA_CANH_BAO = 12.0;

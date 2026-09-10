/**
 * Hệ số trần bảo hiểm — BR-dltl-024, ADR-010 QĐ-2.
 *
 * HẰNG SỐ có trích dẫn luật, KHÔNG phải cột cấu hình `GeneralSetting`. Gốc tính (`baseSalary`,
 * `regionMinSalary`) đã là cột cấu hình sẵn có — nghị định đổi lương cơ sở/lương tối thiểu vùng
 * là trần tự đúng theo. Bản thân hệ số `20` nằm trong luật, không phải thứ từng công ty tự đặt;
 * thêm cột cho nó chỉ tạo thêm một đường để cấu hình sai (xem ADR-010 Mục "Alternatives").
 *
 * TUYỆT ĐỐI KHÔNG lưu số tiền trần tuyệt đối (46.800.000 / 99.200.000) vào cấu hình: sửa
 * `baseSalary` mà quên sửa trần là sai âm thầm — đúng bệnh `unionFeeMaxAmount = 234.000` đang mắc.
 */

/** Trần đóng BHXH + BHYT = 20 lần lương cơ sở — Luật BHXH 2014 Điều 89 Khoản 3. */
export const SO_LAN_LUONG_CO_SO_TRAN_BHXH_BHYT = 20;

/** Trần đóng BHTN = 20 lần lương tối thiểu vùng — Luật Việc làm 2013 Điều 58 Khoản 2. */
export const SO_LAN_LUONG_TOI_THIEU_VUNG_TRAN_BHTN = 20;

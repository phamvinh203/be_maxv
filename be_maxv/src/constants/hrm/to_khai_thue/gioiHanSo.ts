/**
 * Giới hạn số của sub-cụm `to_khai_thue`, theo KIỂU CỘT lưu trữ (RVW-723). Chặn ở tầng kiểm đầu vào thì là
 * 400 có mã; để lọt xuống thì Postgres báo tràn cột và máy chủ trả 500 vô danh.
 */

/** Một khoản chi trả nhập vào: dưới 1.000 tỷ đồng — gõ thừa số 0 là báo lỗi ngay, trước khi quy đổi NET. */
export const TIEN_KHOAN_TOI_DA = 999_999_999_999;

/** Cột `Decimal(15,2)` của danh mục: trần miễn thuế, ngưỡng khấu trừ. */
export const TIEN_DANH_MUC_TOI_DA = 9_999_999_999_999;

/**
 * Cột `Decimal(18,2)` (16 chữ số phần nguyên): tiền của khoản, dòng Bảng tính thuế, chỉ tiêu tiền của tờ khai.
 * Chỉ nhận 15 chữ số để chỉ tiêu tổng ([21] = [22] + [23], [29] = [30] + [31]) vẫn vừa cột.
 */
export const TIEN_TOI_DA = 999_999_999_999_999;

/** Cột `Int` (int4) `ct16` của tờ khai — trần chung cho chỉ tiêu đếm người. */
export const SO_NGUOI_TOI_DA = 2_147_483_647;

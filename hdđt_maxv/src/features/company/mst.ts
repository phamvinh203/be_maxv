/**
 * Quy tắc mã số thuế, gom một chỗ để quan hệ giữa hai dạng nhìn thấy được ngay:
 * MST chi nhánh chỉ là MST gốc cộng đuôi 3 số.
 */

/**
 * MST hợp lệ để LƯU:
 * - 10 số (doanh nghiệp/tổ chức), kèm đuôi chi nhánh `-XXX` tùy chọn;
 * - 12 số (hộ kinh doanh cá thể / cá nhân, cấp theo CCCD) — dạng này không có đuôi chi nhánh.
 */
export const MST_REGEX = /^([0-9]{10}(-[0-9]{3})?|[0-9]{12})$/;

/**
 * MST hợp lệ để TRA CỨU tại api.xinvoice.vn: 10 số (doanh nghiệp) hoặc 12 số (hộ kinh doanh),
 * không đuôi chi nhánh — API đó trả 404 cho dạng `0201964163-001`, nên bắn đi là chắc chắn phí
 * một lượt trong hạn mức 10 lần/30 giây.
 */
export const MST_LOOKUP_REGEX = /^([0-9]{10}|[0-9]{12})$/;

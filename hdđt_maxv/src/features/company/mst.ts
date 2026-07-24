/**
 * Quy tắc mã số thuế, gom một chỗ để quan hệ giữa hai dạng nhìn thấy được ngay:
 * MST chi nhánh chỉ là MST gốc cộng đuôi 3 số.
 */

/** MST hợp lệ để LƯU: 10 số, kèm đuôi chi nhánh `-XXX` tùy chọn. */
export const MST_REGEX = /^[0-9]{10}(-[0-9]{3})?$/;

/**
 * MST hợp lệ để TRA CỨU tại api.xinvoice.vn: đúng 10 số, không đuôi chi nhánh — API đó trả 404 cho
 * dạng `0201964163-001`, nên bắn đi là chắc chắn phí một lượt trong hạn mức 10 lần/30 giây.
 */
export const MST_LOOKUP_REGEX = /^[0-9]{10}$/;

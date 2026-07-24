/**
 * Cách đọc `sync_log.dien_giai`. BE ghi theo khuôn `"<Hành động> hóa đơn <chiều> — <lý do>"`
 * (xem `buildDienGiai` trong be_maxv/src/services/client/hddt/gdt.service.ts).
 *
 * Đây là NƠI DUY NHẤT biết khuôn đó — cột "Diễn giải", toast tóm tắt và tooltip đều đi qua đây
 * thay vì mỗi chỗ tự cắt chuỗi. Cũng là chỗ duy nhất phải sửa nếu BE đổi cách ghi.
 */

/** Khớp tiền tố hành động của các dòng ghi theo khuôn MỚI, kèm dấu gạch ngăn lý do (nếu có). */
const ACTION_PREFIX = /^(?:Đồng bộ|Cập nhật) hóa đơn (?:đầu vào|đầu ra)(?: — )?/;

/** Từ ngữ chiều hóa đơn của BE — dùng dựng lại nhãn cho dòng CŨ để cột không lẫn hai cách gọi. */
const DIRECTION_TEXT: Record<string, string> = {
  purchase: "đầu vào",
  sold: "đầu ra",
  all: "tất cả",
};

interface SyncLogRowText {
  dien_giai: string | null;
  direction: string;
}

/**
 * Chuỗi cho cột "Diễn giải". Dòng ghi theo khuôn mới thì hiện nguyên; dòng CŨ (trước khi BE ghi
 * nhãn hành động, `dien_giai` khi đó chỉ chứa lý do) thì dựng nhãn từ cột `direction` — lý do của
 * chúng vẫn xem được ở tooltip trạng thái.
 */
export function syncLogDescription(row: SyncLogRowText): string {
  if (row.dien_giai && ACTION_PREFIX.test(row.dien_giai)) return row.dien_giai;
  return `Đồng bộ hóa đơn ${DIRECTION_TEXT[row.direction] ?? row.direction}`;
}

/**
 * Chỉ phần LÝ DO, đã bỏ tiền tố hành động — dùng cho toast/tooltip vốn đã tự nêu chiều và trạng
 * thái, nếu để nguyên `dien_giai` sẽ đọc thành "Mua vào — chưa hoàn thành: Đồng bộ hóa đơn đầu
 * vào — ...". Dòng cũ không có tiền tố nên trả về nguyên văn.
 */
export function syncLogReason(dienGiai: string | null | undefined): string {
  return (dienGiai ?? "").replace(ACTION_PREFIX, "");
}

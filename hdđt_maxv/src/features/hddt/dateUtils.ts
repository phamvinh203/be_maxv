/**
 * Định dạng ngày (chuỗi ISO/date) -> dd/MM/yyyy kiểu Việt Nam; rỗng/không hợp lệ trả lại nguyên input.
 * Dùng: `InvoiceListTabs` (cột Ngày lập), `SyncInvoiceDialog` (cột Từ/Đến ngày), `exportInvoices`.
 */
export function formatDateVN(s?: string): string {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("vi-VN");
}

/**
 * Định dạng ngày giờ -> dd/MM/yyyy HH:mm kiểu Việt Nam.
 * Dùng: `SyncInvoiceDialog` (cột "Ngày đồng bộ" trong bảng lịch sử).
 */
export function formatDateTimeVN(s?: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.toLocaleDateString("vi-VN")} ${d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * yyyy-MM-dd cho <input type="date">.
 * Dùng: nội bộ file này — `currentMonthRange`.
 */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Khoảng mặc định = tháng hiện tại (từ ngày 1 -> hôm nay), định dạng yyyy-MM-dd.
 * Dùng: `InvoiceListTabs.defaultMonthFilters` và `SyncInvoiceDialog` (state `range` ban đầu).
 */
export function currentMonthRange(): { tuNgay: string; denNgay: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { tuNgay: toDateInput(first), denNgay: toDateInput(now) };
}

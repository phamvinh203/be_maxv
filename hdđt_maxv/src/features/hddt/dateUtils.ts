/**
 * Định dạng ngày -> dd/MM/yyyy có ĐỆM 0 (01/01/2026, không phải 1/1/2026).
 * Tự ghép thay vì `toLocaleDateString("vi-VN")` — locale này bỏ số 0 đứng đầu.
 * Dùng: nội bộ file này (formatDateVN/formatDateTimeVN).
 */
function padDateVN(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1,
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * Định dạng ngày (chuỗi ISO/date) -> dd/MM/yyyy có đệm 0; rỗng/không hợp lệ trả lại nguyên input.
 * Dùng: `InvoiceListTabs` (cột Ngày lập/Ngày ký), `SyncInvoiceDialog` (cột Từ/Đến ngày), `exportInvoices`.
 */
export function formatDateVN(s?: string): string {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : padDateVN(d);
}

/**
 * Định dạng ngày giờ -> dd/MM/yyyy HH:mm (ngày có đệm 0) kiểu Việt Nam.
 * Dùng: `SyncInvoiceDialog` (cột "Ngày đồng bộ" trong bảng lịch sử).
 */
export function formatDateTimeVN(s?: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${padDateVN(d)} ${d.toLocaleTimeString("vi-VN", {
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

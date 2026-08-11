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
 * Cắt phần `yyyy-MM-dd` ở ĐẦU chuỗi, KHÔNG qua `new Date`. Đây là nơi DUY NHẤT trong app biết định
 * dạng ngày mà BE trả về, nên mọi hàm đọc "ngày trên chứng từ" phải dựng trên nó.
 *
 * Vì sao không quy đổi: BE đã chuẩn hóa mọi ngày về GIỜ VIỆT NAM không hậu tố múi giờ (`toVnWallClock`
 * ở `gdt.service.ts`, xem mục "Quy ước ngày giờ" trong `docs/14-hop-dong-api.md`). Ngày lập/ngày ký là
 * dữ liệu trên CHỨNG TỪ — cho `new Date` đụng vào là ngày đổi theo múi giờ máy đang xem.
 * Không khớp dạng -> null (nơi gọi tự lo phần dự phòng).
 */
export function vnDateParts(s?: string): { y: string; m: string; d: string } | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null;
  return m ? { y: m[1], m: m[2], d: m[3] } : null;
}

/**
 * Định dạng ngày -> dd/MM/yyyy có đệm 0; rỗng/không hợp lệ trả lại nguyên input.
 * Dùng: `InvoiceListTabs` (cột Ngày lập/Ngày ký), `SyncInvoiceDialog` (cột Từ/Đến ngày), `exportInvoices`.
 * Ưu tiên cắt chuỗi (`vnDateParts`) nên KHÔNG phụ thuộc múi giờ trình duyệt; chỉ chuỗi lạ mới rơi
 * xuống `new Date` — nhánh dự phòng, không phải đường chính.
 */
export function formatDateVN(s?: string): string {
  if (!s) return "";
  const p = vnDateParts(s);
  if (p) return `${p.d}/${p.m}/${p.y}`;
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
 * Dùng: nội bộ file này — `currentMonthRange`, `formatDateIso`.
 */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Ngày -> yyyy-MM-dd; rỗng/không hợp lệ trả "".
 * Cùng dựng trên `vnDateParts` như `formatDateVN` — hai hàm BẮT BUỘC cho cùng một ngày, nếu không cột
 * "Ngày lập" và tên file suy từ chính ngày đó sẽ lệch nhau một ngày ở các hóa đơn sát nửa đêm.
 * Dùng: `invoiceFileName.invoiceFileBase`.
 */
export function formatDateIso(s?: string): string {
  if (!s) return "";
  const p = vnDateParts(s);
  if (p) return `${p.y}-${p.m}-${p.d}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : toDateInput(d);
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

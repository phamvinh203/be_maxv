/**
 * Đẩy `blob` xuống thư mục Tải xuống của trình duyệt.
 *
 * Thẻ `<a download>` chứ không `window.open`: trình duyệt chặn popup, và cách này đặt được
 * TÊN FILE. Dùng chung cho mọi lượt tải MỘT file lẻ (khác luồng chọn thư mục hàng loạt ở
 * `fileSystemAccess.ts`) — xem `taiMotHoaDon.ts` (khu Hóa đơn) và `taiFileHoSo.ts` (khu Dịch
 * vụ công).
 */
export function luuVeMay(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

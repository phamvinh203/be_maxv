/**
 * Định dạng số tiền theo locale vi-VN (1.234.567); không phải số thì trả chuỗi rỗng.
 * Dùng chung: bảng "Tổng quát" (InvoiceListTabs) và bảng "Chi tiết hóa đơn" (InvoiceDetailPanel).
 */
export function formatMoney(n?: number): string {
  if (typeof n !== "number") return "";
  return n.toLocaleString("vi-VN");
}

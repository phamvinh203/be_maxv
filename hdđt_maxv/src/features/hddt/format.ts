/**
 * Định dạng số tiền theo locale vi-VN (1.234.567); không phải số thì trả chuỗi rỗng.
 * Dùng chung: bảng "Tổng quát" (InvoiceListTabs) và bảng "Chi tiết hóa đơn" (InvoiceDetailPanel).
 */
export function formatMoney(n?: number): string {
  if (typeof n !== "number") return "";
  return n.toLocaleString("vi-VN");
}

/**
 * Nhãn cột "T. thái tải" theo `tt_tai`: "OK" -> "OK", "error" -> "Lỗi", còn lại "" (chưa tải).
 * Dùng chung: cột Tổng quát (InvoiceListTabs) và file xuất Excel (exportXlsx).
 */
export function ttTaiLabel(v?: string): string {
  return v === "OK" ? "OK" : v === "error" ? "Lỗi" : "";
}

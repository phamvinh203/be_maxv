import { trangThaiHdLabel } from "./api/gdt";
import type { DisplayRow, InvoiceDirection } from "./types";
import { formatDateVN } from "./dateUtils";

interface Column {
  header: string;
  value: (row: DisplayRow, index: number) => string | number;
}

/**
 * Cột xuất Excel — chỉ các cột có dữ liệu thật (bỏ cột placeholder "—" và cột nút thao tác).
 * Dùng: nội bộ file này — `exportInvoicesToCsv`.
 */
function columns(direction: InvoiceDirection): Column[] {
  const isPurchase = direction === "purchase";
  return [
    { header: "STT", value: (_r, i) => i + 1 },
    { header: "Ký hiệu mẫu số", value: (r) => r.mauHd },
    { header: "Ký hiệu hóa đơn", value: (r) => r.soSeri },
    { header: "Số hóa đơn", value: (r) => r.soHd },
    { header: "Ngày lập", value: (r) => formatDateVN(r.ngayLap) },
    { header: isPurchase ? "MST người bán" : "MST người xuất hàng", value: (r) => r.sellerMst },
    { header: isPurchase ? "Tên người bán" : "Tên người xuất hàng", value: (r) => r.sellerTen },
    { header: "Địa chỉ người bán", value: (r) => r.sellerDiaChi },
    { header: isPurchase ? "MST người mua" : "MST người nhận hàng", value: (r) => r.buyerMst },
    { header: isPurchase ? "Tên người mua" : "Tên người nhận hàng", value: (r) => r.buyerTen },
    { header: "Tổng tiền chưa thuế", value: (r) => r.tienChuaThue ?? "" },
    { header: "Tổng tiền thuế", value: (r) => r.tienThue ?? "" },
    { header: "Tổng tiền chiết khấu thương mại", value: (r) => r.cktm ?? "" },
    { header: "Tổng tiền phí", value: (r) => r.phi ?? "" },
    { header: "Tổng tiền thanh toán", value: (r) => r.tongTt },
    { header: "Đơn vị tiền tệ", value: (r) => r.maNt },
    { header: "Tỷ giá", value: (r) => r.tyGia ?? "" },
    { header: "Trạng thái hóa đơn", value: (r) => trangThaiHdLabel(r.trangThaiHd) },
    { header: "Kết quả kiểm tra hóa đơn", value: (r) => r.ketQuaKt },
  ];
}

/**
 * Bọc 1 ô CSV: escape dấu nháy kép và bọc trong "" nếu chứa ký tự đặc biệt.
 * Dùng: nội bộ file này — `exportInvoicesToCsv` (cho cả header lẫn từng ô).
 */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Ghi mảng dòng CSV ra file + kích hoạt tải về. Có BOM UTF-8 để Excel hiển thị đúng tiếng Việt.
 * Dùng: nội bộ file này — `exportInvoicesToCsv`, `exportSavedBackupCsv`.
 */
function downloadCsv(lines: string[], filename: string): void {
  const bom = String.fromCharCode(0xfeff);
  const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Xuất danh sách hóa đơn đang hiển thị (1 chiều) ra file CSV.
 * Dùng: `InvoiceListTabs` — nút "Xuất hóa đơn (Excel)".
 */
export function exportInvoicesToCsv(rows: DisplayRow[], direction: InvoiceDirection): void {
  const cols = columns(direction);
  const lines = [
    cols.map((c) => csvCell(c.header)).join(","),
    ...rows.map((row, i) => cols.map((c) => csvCell(c.value(row, i))).join(",")),
  ];
  downloadCsv(lines, `hoa-don-${direction === "purchase" ? "dau-vao" : "dau-ra"}.csv`);
}

/** Cột sao lưu — tiêu đề trung tính (dùng chung cho cả 2 chiều), thêm cột "Chiều". */
function backupColumns(): Column[] {
  return [
    { header: "STT", value: (_r, i) => i + 1 },
    { header: "Ký hiệu mẫu số", value: (r) => r.mauHd },
    { header: "Ký hiệu hóa đơn", value: (r) => r.soSeri },
    { header: "Số hóa đơn", value: (r) => r.soHd },
    { header: "Ngày lập", value: (r) => formatDateVN(r.ngayLap) },
    { header: "MST người bán", value: (r) => r.sellerMst },
    { header: "Tên người bán", value: (r) => r.sellerTen },
    { header: "MST người mua", value: (r) => r.buyerMst },
    { header: "Tên người mua", value: (r) => r.buyerTen },
    { header: "Tổng tiền chưa thuế", value: (r) => r.tienChuaThue ?? "" },
    { header: "Tổng tiền thuế", value: (r) => r.tienThue ?? "" },
    { header: "Tổng tiền thanh toán", value: (r) => r.tongTt },
    { header: "Đơn vị tiền tệ", value: (r) => r.maNt },
    { header: "Trạng thái hóa đơn", value: (r) => trangThaiHdLabel(r.trangThaiHd) },
  ];
}

/**
 * Sao lưu TOÀN BỘ hóa đơn đã lưu (cả 2 chiều) ra 1 file CSV, có cột "Chiều" phân biệt.
 * Dùng: `SystemDataTab` — nút "Xuất / Sao lưu dữ liệu".
 */
export function exportSavedBackupCsv(purchase: DisplayRow[], sold: DisplayRow[]): void {
  const cols = backupColumns();
  const tagged = [
    ...purchase.map((r) => ({ chieu: "Mua vào", r })),
    ...sold.map((r) => ({ chieu: "Bán ra", r })),
  ];
  const header = ["Chiều", ...cols.map((c) => c.header)].map(csvCell).join(",");
  const body = tagged.map(({ chieu, r }, i) =>
    [csvCell(chieu), ...cols.map((c) => csvCell(c.value(r, i)))].join(","),
  );
  downloadCsv([header, ...body], "sao-luu-hoa-don.csv");
}

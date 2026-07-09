import { trangThaiHdLabel, type InvoiceDirection } from "./api/gdt";
import type { DisplayRow } from "./components/InvoiceListTabs";

interface Column {
  header: string;
  value: (row: DisplayRow, index: number) => string | number;
}

function fmtDate(s?: string): string {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("vi-VN");
}

/** Cột xuất Excel — chỉ các cột có dữ liệu thật (bỏ cột placeholder "—" và cột nút thao tác). */
function columns(direction: InvoiceDirection): Column[] {
  const isPurchase = direction === "purchase";
  return [
    { header: "STT", value: (_r, i) => i + 1 },
    { header: "Ký hiệu mẫu số", value: (r) => r.mauHd },
    { header: "Ký hiệu hóa đơn", value: (r) => r.soSeri },
    { header: "Số hóa đơn", value: (r) => r.soHd },
    { header: "Ngày lập", value: (r) => fmtDate(r.ngayLap) },
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

/** Bọc 1 ô CSV: escape dấu nháy kép và bọc trong "" nếu chứa ký tự đặc biệt. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Xuất danh sách hóa đơn đang hiển thị ra file CSV (Excel mở trực tiếp).
 * Dùng BOM UTF-8 để Excel hiển thị đúng tiếng Việt; số tiền để dạng số thô để Excel tính được.
 */
export function exportInvoicesToCsv(rows: DisplayRow[], direction: InvoiceDirection): void {
  const cols = columns(direction);
  const lines = [
    cols.map((c) => csvCell(c.header)).join(","),
    ...rows.map((row, i) => cols.map((c) => csvCell(c.value(row, i))).join(",")),
  ];
  const csv = lines.join("\r\n");

  // BOM UTF-8 (U+FEFF) ở đầu file để Excel nhận đúng bảng mã, không lỗi font tiếng Việt.
  const bom = String.fromCharCode(0xfeff);
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hoa-don-${direction === "purchase" ? "dau-vao" : "dau-ra"}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

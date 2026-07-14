import { trangThaiHdLabel, ketQuaKiemTraLabel } from "./api/gdt";
import { formatDateVN } from "./dateUtils";
import { ttTaiLabel } from "./format";
import type { DetailRow, DisplayRow, InvoiceDirection } from "./types";

/** 1 cột xuất Excel: tiêu đề + độ rộng + (tuỳ chọn) định dạng số + hàm lấy giá trị ô. */
interface XlsxColumn<T> {
  header: string;
  width: number;
  /** numFmt kiểu Excel cho cột số (vd "#,##0"); bỏ trống nếu là chữ. */
  numFmt?: string;
  value: (row: T, index: number) => string | number;
}

const MONEY_FMT = "#,##0";
const NUM_FMT = "#,##0.##";
const HEADER_FILL = "FFDDE6F2"; // xanh nhạt
const HEADER_HEIGHT = 26;
const ROW_HEIGHT = 20;

/** Cột bảng "Tổng quát" (khớp cột đang hiển thị, bỏ cột checkbox "Chọn"). */
function overviewColumns(direction: InvoiceDirection): XlsxColumn<DisplayRow>[] {
  const isPurchase = direction === "purchase";
  return [
    { header: "STT", width: 6, value: (_r, i) => i + 1 },
    { header: "T. thái tải", width: 11, value: (r) => ttTaiLabel(r.ttTai) },
    { header: "Ký hiệu mẫu số", width: 14, value: (r) => r.mauHd },
    { header: "Ký hiệu hóa đơn", width: 16, value: (r) => r.soSeri },
    { header: "Số hóa đơn", width: 12, value: (r) => r.soHd },
    { header: "Ngày lập", width: 12, value: (r) => formatDateVN(r.ngayLap) },
    { header: "Ngày ký", width: 12, value: (r) => formatDateVN(r.ngayKy) },
    {
      header: isPurchase ? "MST người bán" : "MST người xuất hàng",
      width: 15,
      value: (r) => r.sellerMst,
    },
    {
      header: isPurchase ? "Tên người bán" : "Tên người xuất hàng",
      width: 34,
      value: (r) => r.sellerTen,
    },
    { header: "Tổng tiền chưa thuế", width: 17, numFmt: MONEY_FMT, value: (r) => r.tienChuaThue ?? "" },
    { header: "Tổng tiền thuế", width: 15, numFmt: MONEY_FMT, value: (r) => r.tienThue ?? "" },
    { header: "Tổng CKTM", width: 14, numFmt: MONEY_FMT, value: (r) => r.cktm ?? "" },
    { header: "Tổng phí", width: 12, numFmt: MONEY_FMT, value: (r) => r.phi ?? "" },
    { header: "Tổng tiền thanh toán", width: 18, numFmt: MONEY_FMT, value: (r) => r.tongTt },
    { header: "Mã nt", width: 8, value: (r) => r.maNt },
    { header: "Tỷ giá", width: 10, numFmt: NUM_FMT, value: (r) => r.tyGia ?? "" },
    { header: "Trạng thái hóa đơn", width: 18, value: (r) => trangThaiHdLabel(r.trangThaiHd) },
    { header: "Kết quả kiểm tra", width: 16, value: (r) => ketQuaKiemTraLabel(r.ketQuaKt) },
    { header: "Mã ct hạch toán", width: 14, value: () => "" },
    { header: "Tên chứng từ hạch toán", width: 22, value: () => "" },
    { header: "Hóa đơn rủi ro", width: 13, value: () => "" },
  ];
}

/** Cột bảng "Chi tiết hóa đơn" (27 cột, khớp InvoiceDetailPanel). */
function detailColumns(): XlsxColumn<DetailRow>[] {
  return [
    { header: "STT", width: 6, value: (_r, i) => i + 1 },
    { header: "Mẫu số", width: 12, value: (r) => r.mauHd },
    { header: "Ký hiệu", width: 14, value: (r) => r.kyHieu },
    { header: "Số hóa đơn", width: 12, value: (r) => r.soHd },
    { header: "Ngày hóa đơn", width: 13, value: (r) => formatDateVN(r.ngayHd) },
    { header: "MST/người bán", width: 15, value: (r) => r.sellerMst },
    { header: "Tên người bán", width: 32, value: (r) => r.sellerTen },
    { header: "Tên hàng hóa", width: 36, value: (r) => r.tenHang },
    { header: "Đvt", width: 8, value: (r) => r.dvt },
    { header: "Số lượng", width: 11, numFmt: NUM_FMT, value: (r) => r.soLuong ?? "" },
    { header: "Giá", width: 14, numFmt: NUM_FMT, value: (r) => r.gia ?? "" },
    { header: "Tiền CK", width: 12, numFmt: MONEY_FMT, value: (r) => r.tienCk ?? "" },
    { header: "Tiền chưa thuế", width: 15, numFmt: MONEY_FMT, value: (r) => r.tienChuaThue ?? "" },
    { header: "Thuế", width: 13, numFmt: MONEY_FMT, value: (r) => r.thue ?? "" },
    { header: "Tiền sau thuế", width: 15, numFmt: MONEY_FMT, value: (r) => r.tienSauThue ?? "" },
    { header: "TL CKTM", width: 10, numFmt: NUM_FMT, value: (r) => r.tlCktm ?? "" },
    { header: "Thuế suất", width: 10, value: (r) => r.thueSuat },
    { header: "Mã nt", width: 8, value: (r) => r.maNt },
    { header: "Tỷ giá", width: 10, numFmt: NUM_FMT, value: (r) => r.tyGia ?? "" },
    { header: "Tổng tiền hàng", width: 16, numFmt: MONEY_FMT, value: (r) => r.tongTienHang ?? "" },
    { header: "Tổng tiền thuế", width: 15, numFmt: MONEY_FMT, value: (r) => r.tongThue ?? "" },
    { header: "Tổng CK", width: 13, numFmt: MONEY_FMT, value: (r) => r.tongCk ?? "" },
    { header: "Tổng phí", width: 12, numFmt: MONEY_FMT, value: (r) => r.tongPhi ?? "" },
    { header: "Tổng thanh toán", width: 17, numFmt: MONEY_FMT, value: (r) => r.tongTt ?? "" },
    { header: "Hình thức thanh toán", width: 18, value: (r) => r.hinhThucTt },
    { header: "Trạng thái hóa đơn", width: 18, value: (r) => trangThaiHdLabel(r.trangThaiHd) },
    { header: "Kết quả kiểm tra", width: 16, value: (r) => ketQuaKiemTraLabel(r.ketQuaKt) },
  ];
}

/** Kích hoạt tải buffer XLSX về máy. */
function downloadXlsx(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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
 * Dựng 1 sheet có tiêu đề IN ĐẬM + nền + freeze + auto-filter, GIÃN DÒNG (chiều cao hàng thoáng),
 * rồi tải file .xlsx về. Lõi dùng chung cho xuất Tổng quát và Chi tiết.
 */
async function buildAndDownload<T>(
  sheetName: string,
  cols: XlsxColumn<T>[],
  rows: T[],
  filename: string,
): Promise<void> {
  // Lazy-load exceljs (~1MB) — chỉ tải khi người dùng thực sự bấm Xuất, không nằm trong bundle chính.
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }], // giữ hàng tiêu đề khi cuộn
  });

  ws.columns = cols.map((c) => ({ header: c.header, width: c.width }));

  // Hàng tiêu đề: in đậm, nền nhạt, căn giữa, xuống dòng, cao thoáng.
  const headerRow = ws.getRow(1);
  headerRow.height = HEADER_HEIGHT;
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Định dạng số theo cột (giữ giá trị số để Excel cộng/lọc được).
  cols.forEach((c, i) => {
    if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt;
  });

  // Dữ liệu: mỗi hàng giãn dòng cho dễ đọc.
  rows.forEach((row, i) => {
    const r = ws.addRow(cols.map((c) => c.value(row, i)));
    r.height = ROW_HEIGHT;
    r.alignment = { vertical: "middle" };
  });

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: cols.length },
  };

  const buffer = await wb.xlsx.writeBuffer();
  downloadXlsx(buffer as ArrayBuffer, filename);
}

const DIR_LABEL: Record<InvoiceDirection, { text: string; slug: string }> = {
  purchase: { text: "đầu vào", slug: "dau-vao" },
  sold: { text: "đầu ra", slug: "dau-ra" },
};

/** Khoảng ngày đang lọc — thêm vào tên file để dễ nhận biết file thuộc kỳ nào. */
export interface ExportRange {
  tuNgay: string;
  denNgay: string;
}

/** Đuôi tên file "tu-<từ>-den-<đến>" (rỗng nếu thiếu ngày). */
function rangeSuffix(range: ExportRange): string {
  return range.tuNgay && range.denNgay ? `-tu-${range.tuNgay}-den-${range.denNgay}` : "";
}

/** Xuất bảng "Tổng quát" của 1 chiều ra .xlsx (tiêu đề in đậm, giãn dòng). */
export function exportOverviewXlsx(
  rows: DisplayRow[],
  direction: InvoiceDirection,
  range: ExportRange,
): Promise<void> {
  const { text, slug } = DIR_LABEL[direction];
  return buildAndDownload(
    `Tổng quát ${text}`,
    overviewColumns(direction),
    rows,
    `hoa-don-${slug}-tong-quat${rangeSuffix(range)}.xlsx`,
  );
}

/** Xuất bảng "Chi tiết hóa đơn" của 1 chiều ra .xlsx (tiêu đề in đậm, giãn dòng). */
export function exportDetailXlsx(
  rows: DetailRow[],
  direction: InvoiceDirection,
  range: ExportRange,
): Promise<void> {
  const { text, slug } = DIR_LABEL[direction];
  return buildAndDownload(
    `Chi tiết ${text}`,
    detailColumns(),
    rows,
    `hoa-don-${slug}-chi-tiet${rangeSuffix(range)}.xlsx`,
  );
}

/**
 * Sinh file .xlsx từ template cột — file này chỉ lo DỰNG FILE (style sheet, workbook, tên file).
 * Danh sách cột nằm ở `templates/`, dùng chung với bảng trên web nên hai bên không lệch nhau được.
 */
import type { Workbook } from "exceljs";
import { detailColumns, fileColumns, overviewColumns, type InvoiceColumn } from "./templates";
import type { DetailRow, DisplayRow, InvoiceDirection } from "./types";

// Trang trí sheet — không gắn với cột nào nên thuộc về file này, không thuộc template cột.
const HEADER_FILL = "FFDDE6F2"; // xanh nhạt
const HEADER_HEIGHT = 26;
const ROW_HEIGHT = 20;

/**
 * Thêm 1 sheet có tiêu đề IN ĐẬM + nền + freeze + auto-filter, GIÃN DÒNG (chiều cao hàng thoáng) vào
 * workbook. Lõi dùng chung cho sheet Tổng quát và Chi tiết.
 * Cột `webOnly` (checkbox "Chọn") bị loại — chỉ có nghĩa trên màn hình.
 */
function addStyledSheet<T>(
  wb: Workbook,
  sheetName: string,
  allCols: InvoiceColumn<T>[],
  rows: T[],
): void {
  const cols = fileColumns(allCols);
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

  // Dữ liệu: mỗi hàng giãn dòng cho dễ đọc. `stt` 1-based — cùng quy ước với bảng trên web.
  rows.forEach((row, i) => {
    const r = ws.addRow(cols.map((c) => c.value(row, i + 1)));
    r.height = ROW_HEIGHT;
    r.alignment = { vertical: "middle" };
  });

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: cols.length },
  };
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

/**
 * Dựng workbook "tổng hợp" 1 chiều gồm 2 sheet (Tổng quát + Chi tiết) và trả `ArrayBuffer` để GHI ra
 * file (không tải về). Dùng cho nút "Xuất file tổng hợp + hóa đơn" (ghi Excel vào thư mục người dùng
 * chọn qua File System Access, cạnh các file HĐ).
 */
export async function buildSummaryWorkbookBuffer(
  overviewRows: DisplayRow[],
  detailRows: DetailRow[],
  direction: InvoiceDirection,
): Promise<ArrayBuffer> {
  // Lazy-load exceljs (~1MB) — chỉ tải khi người dùng thực sự bấm Xuất, không nằm trong bundle chính.
  const { Workbook } = await import("exceljs");
  const { text } = DIR_LABEL[direction];
  const wb = new Workbook();
  addStyledSheet(wb, `Tổng quát ${text}`, overviewColumns(direction), overviewRows);
  addStyledSheet(wb, `Chi tiết ${text}`, detailColumns(direction), detailRows);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Tên file Excel tổng hợp trong thư mục xuất (khớp `rangeSuffix`). */
export function summaryWorkbookFilename(direction: InvoiceDirection, range: ExportRange): string {
  const { slug } = DIR_LABEL[direction];
  return `Tong-hop-${slug}${rangeSuffix(range)}.xlsx`;
}

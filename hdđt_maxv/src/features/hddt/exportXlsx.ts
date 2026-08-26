/**
 * Sinh file .xlsx từ template cột — file này chỉ lo DỰNG FILE (style sheet, workbook, tên file).
 * Danh sách cột nằm ở `templates/`, dùng chung với bảng trên web nên hai bên không lệch nhau được.
 */
import type { Workbook } from "exceljs";
import {
  detailColumns,
  fileColumns,
  invoiceRowFill,
  overviewColumns,
  tongCotSo,
  TOTAL_ROW_LABEL,
  TOTAL_TEXT_ARGB,
  type InvoiceColumn,
} from "./templates";
import type { ExcelCellStyle } from "./templates/types";
import type { DetailRow, DisplayRow, InvoiceDirection } from "./types";

// Trang trí sheet — không gắn với cột nào nên thuộc về file này, không thuộc template cột.
export const HEADER_FILL = "FFDDE6F2"; // xanh nhạt
export const HEADER_HEIGHT = 40; // đủ cho tiêu đề dài xuống dòng ở các cột hẹp
/** Chiều cao các hàng KHÔNG có `wrapText` (hàng tổng) — hàng dữ liệu để Excel tự co, xem bên dưới. */
const ROW_HEIGHT = 20;

/**
 * Căn ô vùng dữ liệu: NGẮT DÒNG trong ô thay vì để chữ tràn/cụt.
 *
 * Không có `wrapText`, ô dài (tên hàng hóa, địa chỉ, hai cột ghi chú, URL tra cứu) chỉ hiện được
 * phần lọt trong bề rộng cột: tràn sang ô bên nếu ô đó trống, còn không thì CẮT NGANG — nhìn thì
 * tưởng dữ liệu bị thiếu. Nới rộng cột không phải là cách: bề rộng ở template bám mẫu Excel của kế
 * toán, mà nới đủ cho địa chỉ dài nhất thì bảng rộng ra vô lý.
 *
 * `top` chứ không phải `middle`: hàng cao 4-5 dòng mà căn giữa thì các cột ngắn (số hóa đơn, ngày)
 * trôi ra giữa khoảng trắng, mắt khó dóng theo hàng.
 */
const DATA_ALIGNMENT = { vertical: "top", wrapText: true } as const;

/** Viền mảnh 4 cạnh — dùng cho ô tiêu đề và mọi ô dữ liệu. */
export const CELL_BORDER = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
} as const;
/** numFmt "ô chữ" của Excel — áp cho cột có cờ `excelText` (ngày dd/MM/yyyy, mã số). */
const TEXT_FMT = "@";

/**
 * BỐ CỤC SHEET — bám theo mẫu Excel mà kế toán đang dùng, đừng đổi lẻ tẻ:
 *  - sheet CÓ khối tiêu đề: dòng 1 "MST:", dòng 2 "Công ty:", dòng 3 tên bảng (gộp ô), dòng 4 khoảng
 *    ngày (gộp ô), dòng 5 trống, dòng 6 tiêu đề cột, dòng 7 hàng TỔNG, dữ liệu từ dòng 8;
 *  - sheet KHÔNG có khối tiêu đề: dòng 1 tiêu đề cột, dòng 2 hàng TỔNG, dữ liệu từ dòng 3.
 *
 * Hàng TỔNG đứng NGAY DƯỚI tiêu đề cho khớp bảng web; bảng không có cột nào cần cộng (hoặc không có
 * dòng nào) thì không chèn hàng đó và dữ liệu lùi lên sát tiêu đề như cũ.
 */
const BANNER_HEADER_ROW = 6;
/** Không có khối tiêu đề thì vào thẳng hàng tiêu đề cột — không chừa dòng đệm nào ở trên. */
const PLAIN_HEADER_ROW = 1;

/** Khối tiêu đề đầu sheet (gộp hết bề ngang bảng). Bỏ trống = sheet không có khối này. */
interface SheetBanner {
  /**
   * Dòng 1-2 — công ty sở hữu số hóa đơn, mỗi thứ MỘT DÒNG có nhãn riêng ("MST:", "Công ty:") để
   * đọc/lọc/copy từng phần được, thay vì một chuỗi gộp. Bỏ trống thì hai dòng đó để trắng.
   *
   * Nằm TRONG `banner` (không phải tùy chọn riêng của sheet) vì hai dòng này thuộc khối tiêu đề:
   * sheet "Chi tiết" không có khối tiêu đề thì cũng không có phần đơn vị — đúng ý muốn, và cách này
   * khiến không ai lỡ tay bật nó cho sheet không có chỗ đặt.
   */
  donVi?: { mst: string; tenCongTy: string };
  /** Dòng 3 — tên bảng, in hoa đậm (vd "DANH SÁCH HÓA ĐƠN"). */
  title: string;
  /** Dòng 4 — khoảng ngày đang xuất. */
  subtitle: string;
}

/** Tùy chọn của 1 sheet — gom thành object vì đã tới cái thứ hai, thêm tham số vị trí là khó đọc. */
interface SheetOptions<T> {
  banner?: SheetBanner;
  /**
   * Tô màu CẢ HÀNG theo dữ liệu của dòng; `undefined` = để hàng nguyên.
   * Cả hai sheet đều dùng: hóa đơn đã bị thay thế/điều chỉnh/hủy được tô nguyên hàng, lướt file
   * vài nghìn dòng là thấy ngay. Tô cả hàng chứ không chỉ ô "Trạng thái hóa đơn" — cột đó nằm mãi
   * cột 36, cuộn ngang một chút là khuất, tô mỗi nó thì gần như vô hình.
   */
  rowFill?: (row: T) => ExcelCellStyle | undefined;
}

/**
 * Thêm 1 sheet có tiêu đề IN ĐẬM + nền + freeze + auto-filter, GIÃN DÒNG (chiều cao hàng thoáng) vào
 * workbook. Lõi dùng chung cho sheet Tổng quát và Chi tiết.
 * Cột `webOnly` (checkbox "Chọn", đèn "T. thái tải") bị loại — chỉ có nghĩa trên màn hình.
 */
function addStyledSheet<T>(
  wb: Workbook,
  sheetName: string,
  allCols: InvoiceColumn<T>[],
  rows: T[],
  { banner, rowFill }: SheetOptions<T> = {},
): void {
  const cols = fileColumns(allCols);
  const headerAt = banner ? BANNER_HEADER_ROW : PLAIN_HEADER_ROW;

  // Hàng TỔNG nằm NGAY DƯỚI hàng tiêu đề, đúng như bảng trên web -> dữ liệu lùi xuống 1 dòng.
  const tong = tongCotSo(cols, rows);
  const hasTotal = tong.size > 0 && rows.length > 0;
  const totalAt = headerAt + 1;
  const firstDataAt = hasTotal ? headerAt + 2 : headerAt + 1;

  const ws = wb.addWorksheet(sheetName, {
    // Đóng băng tới HẾT hàng tổng: cuộn tới đâu vẫn thấy cả tiêu đề lẫn số tổng.
    views: [{ state: "frozen", ySplit: hasTotal ? totalAt : headerAt }],
  });

  // Chỉ đặt độ rộng + định dạng cho CỘT. Không dùng `ws.columns = [{header}]`: cách đó ghi tiêu đề
  // vào dòng 1, sai chỗ ở bố cục có khối tiêu đề. Giữ giá trị số để Excel cộng/lọc được.
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.width) col.width = c.width;
    if (c.numFmt) col.numFmt = c.numFmt;
    if (c.excelText) col.numFmt = TEXT_FMT;
  });

  if (banner) {
    // Dòng 1-2: đơn vị sở hữu số hóa đơn — file rời khỏi máy vẫn tự nói được nó là của ai. Căn TRÁI
    // theo lối trình bày quen thuộc của báo cáo kế toán; tên bảng + khoảng ngày bên dưới mới căn giữa.
    // Ô nào cũng gộp hết bề ngang bảng để tên công ty dài không bị ô bên cạnh cắt ngang.
    const { donVi } = banner;
    type Line = [row: number, text: string, size: number, horizontal: "left" | "center"];
    const lines: Line[] = [
      [3, banner.title, 14, "center"],
      [4, banner.subtitle, 11, "center"],
    ];
    if (donVi) {
      lines.unshift(
        [1, `MST: ${donVi.mst}`, 11, "left"],
        [2, `Công ty: ${donVi.tenCongTy}`, 11, "left"],
      );
    }
    for (const [row, text, size, horizontal] of lines) {
      ws.mergeCells(row, 1, row, cols.length);
      const cell = ws.getCell(row, 1);
      cell.value = text;
      cell.font = { bold: true, size };
      cell.alignment = { vertical: "middle", horizontal };
    }
  }

  // Hàng tiêu đề: in đậm, nền nhạt, căn giữa, xuống dòng, cao thoáng.
  const headerRow = ws.getRow(headerAt);
  cols.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = CELL_BORDER;
  });
  headerRow.height = HEADER_HEIGHT;
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  // ---- Hàng TỔNG, NGAY DƯỚI hàng tiêu đề — đúng chỗ nó đứng ở bảng web ----
  // Ghi TRƯỚC vùng dữ liệu để `firstDataAt` chỉ có một cách hiểu duy nhất (dữ liệu luôn bắt đầu sau
  // hàng này). Hàng tổng nằm trong vùng đóng băng nên cuộn tới đâu cũng thấy.
  if (hasTotal) {
    const totalRow = ws.getRow(totalAt);
    totalRow.height = ROW_HEIGHT;
    totalRow.alignment = { vertical: "middle" };
    cols.forEach((c, i) => {
      const cell = totalRow.getCell(i + 1);
      // Nhãn ở ô đầu; các cột không cộng để TRỐNG (ghi 0 vào đây là bịa ra số liệu).
      if (i === 0) cell.value = TOTAL_ROW_LABEL;
      else if (tong.has(c.key)) cell.value = tong.get(c.key) ?? null;
      cell.font = { bold: true, color: { argb: TOTAL_TEXT_ARGB } };
      cell.border = CELL_BORDER;
    });
  }

  // Dữ liệu. `stt` 1-based — cùng quy ước với bảng trên web.
  // Ghi theo chỉ số dòng tuyệt đối (không `addRow`) để dữ liệu luôn nằm đúng chỗ dưới hàng tổng.
  // Ô không có dữ liệu ghi `null` -> Excel để TRỐNG, không phải 0.
  //
  // CỐ Ý KHÔNG ĐẶT `r.height`: có `wrapText` mà ghim chiều cao thì Excel bật cờ "chiều cao do người
  // dùng đặt" và thôi tự co giãn — chữ dài xuống dòng xong bị giấu dưới mép ô, tệ hơn cả lúc chưa
  // ngắt dòng. Bỏ trống thì Excel tự tính chiều cao vừa đủ số dòng của ô dài nhất.
  rows.forEach((row, i) => {
    const r = ws.getRow(firstDataAt + i);
    // Đặt style của HÀNG trước rồi mới ghi ô: `row.alignment` quét lại các ô đang có và ghi đè
    // style của chúng, nên làm sau sẽ xóa mất màu nền vừa tô ở dưới.
    r.alignment = DATA_ALIGNMENT;
    const fill = rowFill?.(row);
    cols.forEach((c, ci) => {
      const cell = r.getCell(ci + 1);
      cell.value = c.value(row, i + 1) ?? null;
      // Viền từng ô: cột nào ra cột nấy khi cuộn ngang giữa 46 cột, và ranh giới hàng vẫn rõ khi
      // các hàng cao thấp khác nhau do ngắt dòng.
      cell.border = CELL_BORDER;
      if (!fill) return;
      // Tô TỪNG Ô của vùng dữ liệu, không đặt `r.fill` cấp hàng: style cấp hàng trong xlsx phủ tới
      // tận cột cuối bảng tính, kéo vệt màu chạy dài khỏi mép bảng.
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill.bg } };
      if (fill.fg) cell.font = { color: { argb: fill.fg } };
    });
  });

  // Vùng lọc khai TỪ hàng tiêu đề ĐẾN hàng dữ liệu CUỐI thay vì để Excel tự dò — ít nhất thì nó
  // dừng đúng ở dòng cuối, không nuốt thêm thứ gì viết bên dưới sau này.
  //
  // ĐÁNH ĐỔI ĐÃ BIẾT: hàng tổng nằm GIỮA tiêu đề và dữ liệu nên vẫn lọt vào vùng này (vùng lọc bắt
  // buộc liền mạch từ hàng tiêu đề, không có cách nào chừa một dòng ở giữa) — bấm sắp xếp bằng mũi
  // tên lọc sẽ xếp cả hàng tổng theo. Chấp nhận, vì đây là chỗ người dùng muốn nó đứng; muốn tránh
  // hẳn thì phải đẩy hàng tổng lên TRÊN hàng tiêu đề hoặc xuống dưới cùng, cách một dòng trống.
  ws.autoFilter = {
    from: { row: headerAt, column: 1 },
    to: { row: firstDataAt + Math.max(rows.length - 1, 0), column: cols.length },
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

/** yyyy-MM-dd -> dd-MM-yyyy cho dòng khoảng ngày dưới tên bảng (đúng cách mẫu Excel ghi). */
function dashDateVN(s: string): string {
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}-${m}-${y}` : s;
}

/** Dòng khoảng ngày dưới tên bảng; thiếu ngày -> rỗng (khối tiêu đề vẫn còn tên bảng). */
function rangeBannerLine(range: ExportRange): string {
  if (!range.tuNgay || !range.denNgay) return "";
  return `Từ ngày ${dashDateVN(range.tuNgay)} đến ngày ${dashDateVN(range.denNgay)}`;
}

/**
 * Dựng workbook "tổng hợp" 1 chiều gồm 2 sheet (Tổng quát + Chi tiết) và trả `ArrayBuffer` để GHI ra
 * file (không tải về). Dùng cho nút "Xuất file tổng hợp + hóa đơn" (ghi Excel vào thư mục người dùng
 * chọn qua File System Access, cạnh các file HĐ).
 *
 * Khối tiêu đề (đơn vị + "DANH SÁCH HÓA ĐƠN" + khoảng ngày) CHỈ có ở sheet Tổng quát — sheet Chi tiết
 * vào thẳng hàng tiêu đề cột, giống mẫu Excel của phần mềm kế toán.
 */
export async function buildSummaryWorkbookBuffer(
  overviewRows: DisplayRow[],
  detailRows: DetailRow[],
  direction: InvoiceDirection,
  range: ExportRange,
  donVi?: { mst: string; tenCongTy: string },
): Promise<ArrayBuffer> {
  // Lazy-load exceljs (~1MB) — chỉ tải khi người dùng thực sự bấm Xuất, không nằm trong bundle chính.
  const { Workbook } = await import("exceljs");
  const { text } = DIR_LABEL[direction];
  const wb = new Workbook();
  addStyledSheet(wb, `Tổng quát ${text}`, overviewColumns(direction), overviewRows, {
    banner: { donVi, title: "DANH SÁCH HÓA ĐƠN", subtitle: rangeBannerLine(range) },
    rowFill: invoiceRowFill,
  });
  addStyledSheet(wb, `Chi tiết ${text}`, detailColumns(direction), detailRows, {
    rowFill: invoiceRowFill,
  });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Tên file Excel tổng hợp trong thư mục xuất (khớp `rangeSuffix`). */
export function summaryWorkbookFilename(direction: InvoiceDirection, range: ExportRange): string {
  const { slug } = DIR_LABEL[direction];
  return `Tong-hop-${slug}${rangeSuffix(range)}.xlsx`;
}

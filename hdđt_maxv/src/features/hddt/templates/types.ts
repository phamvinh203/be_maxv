import type { ReactNode } from "react";
import { formatMoney } from "../format";

/** Kiểu tô 1 hàng Excel. Màu dạng ARGB 8 ký tự của exceljs ("FF" + RRGGBB). */
export interface ExcelCellStyle {
  /** Màu nền. */
  bg: string;
  /** Màu chữ — bỏ trống thì giữ màu chữ mặc định. */
  fg?: string;
}

export const TRANG_THAI_HD_FILL: Record<string, ExcelCellStyle> = {
  "2": { bg: "FFDDEBF7" }, // thay thế — xanh nhạt
  "3": { bg: "FFFFF2CC" }, // điều chỉnh — vàng nhạt
  "4": { bg: "FFFCE4D6" }, // đã bị thay thế — cam nhạt
  "5": { bg: "FFF8CBAD" }, // bị điều chỉnh — cam
  "6": { bg: "FFFFC7CE", fg: "FF9C0006" }, // đã bị hủy — hồng, chữ đỏ sẫm
};

/**
 * Tô cả hàng theo trạng thái hóa đơn; `undefined` = hóa đơn mới/mã lạ -> để hàng nguyên.
 * Quy tắc giống nhau cho cả hai chiều nên để chung, không nhân đôi.
 */
/** Màu xám nhạt cho cảnh báo (thiếu địa chỉ người mua, v.v.) */
export const WARNING_FILL: ExcelCellStyle = { bg: "FFE0E0E0" }; 

export function invoiceRowFill(row: {
  trangThaiHd: string;
  buyerDiaChi?: string;
}): ExcelCellStyle | undefined {
  // Ưu tiên trạng thái hóa đơn (đỏ/hồng quan trọng hơn)
  const statusFill = TRANG_THAI_HD_FILL[row.trangThaiHd];
  if (statusFill) return statusFill;

  // Nếu không có trạng thái đặc biệt, kiểm tra warning
  if (!row.buyerDiaChi) return WARNING_FILL;

  return undefined; // Không tô màu
}

export interface InvoiceColumn<T> {
  key: string;
  /** Tiêu đề: hàng 1 của sheet Excel, dòng tiêu đề CSV, `<TableCell>` đầu bảng web. */
  header: string;
  /** Độ rộng cột Excel (đơn vị ký tự). Bỏ trống = để Excel tự co; kênh web và CSV không đọc. */
  width?: number;
  /** Căn lề ô trên web. Kênh file không đọc. */
  align?: "right" | "center";
  /** numFmt kiểu Excel cho cột số (vd "#,##0"). Có numFmt = cột số, web tự gọi `formatMoney`. */
  numFmt?: string;
  excelText?: boolean;
  value: (row: T, stt: number) => string | number | undefined;
  /** Ghi đè hoàn toàn cách render trên web (ô có màu…). Kênh file không đọc. */
  cell?: (row: T, stt: number) => ReactNode;
  /** Chỉ hiện trên web, không xuất ra file — `fileColumns` lọc bỏ. */
  webOnly?: boolean;
  total?: boolean;
}

/** Cột chưa có nguồn dữ liệu (cần API/tính năng riêng, chưa xây) — web hiện tạm "—". */
export const NO_DATA_YET = "—";

export const NUM_FMT = "#,##0"; // Không có phần thập phân
/** Cột tiền: không có phần thập phân, bỏ .0 ở cuối */
export const MONEY2_FMT = "#,##0"; // Không có phần thập phân
/** Tỷ giá: tối thiểu 2 số lẻ (hóa đơn VND ra "1.00" đúng mẫu), giữ đủ số lẻ của tỷ giá ngoại tệ. */
export const RATE_FMT = "0.00######";

/**
 * Render 1 ô trên web. Cột có `cell` thì `cell` quyết định tất cả; còn lại: cột số -> `formatMoney`,
 * cột chữ -> giá trị thô ("—" nếu không có dữ liệu).
 *
 * Nhánh "ưu tiên `cell`" nằm Ở ĐÂY chứ không ở nơi gọi: bảng web nào cũng chỉ cần
 * `renderCell(col, row, stt)`, khỏi phải nhớ ghép `col.cell?.(…) ?? …` — thành ngữ đó vừa dễ quên
 * vừa hiểu nhầm `cell` trả `null` (một ReactNode hợp lệ) thành "không có cell".
 */
export function renderCell<T>(col: InvoiceColumn<T>, row: T, stt: number): ReactNode {
  if (col.cell) return col.cell(row, stt);
  const v = col.value(row, stt);
  if (col.numFmt) return typeof v === "number" ? formatMoney(v) : "";
  return v ?? NO_DATA_YET;
}


export function khongLap(giaTri: string | undefined, ...daHien: (string | undefined)[]): string {
  const v = giaTri?.trim();
  if (!v) return NO_DATA_YET;
  return daHien.some((x) => x?.trim() === v) ? NO_DATA_YET : giaTri!;
}

export function chiDongDau(row: { isFirstRow?: boolean }, noiDung: string): string {
  return row.isFirstRow ? noiDung : "";
}

/**
 * Nội dung cột "Ghi Chú: Các trường hợp đặc biệt kế toán xem xét kỹ hơn" — cảnh báo TỰ SINH từ chính
 * dữ liệu hóa đơn (mẫu Excel của kế toán ghi kiểu "Thiếu địa chỉ người mua").
 *
 * Dùng CHUNG cho cả 4 bảng (Tổng quát + Chi tiết, hai chiều): chúng nói về cùng một hóa đơn nên
 * không được cảnh báo khác nhau. Để Ở ĐÂY chứ không trong `dauRa`/`dauVao`: bản chép đôi trong hai
 * file ĐÃ TỪNG lệch nhau một dấu cách ở chuỗi "không được kê khai", và không có gì ngăn nó tái diễn.
 * Đọc CÙNG hai field với `invoiceRowFill` ngay trên — cùng một luật, một chỗ.
 *
 * Không có cảnh báo nào -> `undefined` (web hiện "—", file xuất để ô trống).
 */
export function ghiChuDacBiet(r: { buyerDiaChi: string; trangThaiHd: string }): string | undefined {
  const warnings: string[] = [];
  if (!r.buyerDiaChi) warnings.push("Thiếu địa chỉ người mua");
  if (r.trangThaiHd === "4") warnings.push("Hóa đơn này không được kê khai");
  return warnings.length > 0 ? warnings.join(". ") : undefined;
}

/** Bỏ cột chỉ dành cho web — mọi kênh ghi ra file (Excel, CSV) phải đi qua hàm này. */
export function fileColumns<T>(cols: InvoiceColumn<T>[]): InvoiceColumn<T>[] {
  return cols.filter((c) => !c.webOnly);
}

/** Nhãn ở ô đầu tiên của hàng tổng. */
export const TOTAL_ROW_LABEL = "TỔNG CỘNG";

export const TOTAL_COL_WIDTH = 18;

/** Màu chữ hàng tổng — đỏ sẫm, ARGB như mọi màu khác trong file này (web đổi sang mã CSS). */
export const TOTAL_TEXT_ARGB = "FFC00000";

/**
 * Cộng các cột có cờ `total` trên TOÀN BỘ `rows` — dùng chung cho hàng tổng của bảng web và của
 * sheet Excel, nên hai nơi không thể ra số khác nhau.
 *
 * Cộng KẾT QUẢ của `value()` chứ không đọc thẳng field, để mọi luật đã cài trong cột tự có hiệu lực.
 * Quan trọng nhất là nhóm cột cấp HÓA ĐƠN ở bảng Chi tiết ("Tổng tiền thanh toán"…): chúng chỉ trả
 * số ở dòng hàng ĐẦU của mỗi hóa đơn, các dòng sau trả `undefined` — nhờ vậy tổng ra đúng một lần
 * mỗi hóa đơn thay vì nhân lên theo số dòng hàng.
 *
 * `stt` truyền vào chỉ để đủ chữ ký hàm; không cột tiền nào đọc tới nó.
 */
export function tongCotSo<T>(cols: InvoiceColumn<T>[], rows: T[]): Map<string, number> {
  const tong = new Map<string, number>();
  for (const col of cols) {
    if (!col.total) continue;
    let s = 0;
    rows.forEach((row, i) => {
      const v = col.value(row, i + 1);
      if (typeof v === "number") s += v;
    });
    tong.set(col.key, s);
  }
  return tong;
}

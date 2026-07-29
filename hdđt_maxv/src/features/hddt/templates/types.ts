/**
 * "Template cột" — khai báo cột hóa đơn MỘT LẦN, dùng chung cho bảng trên web và file Excel/CSV.
 *
 * Trước đây mỗi đầu ra tự khai một danh sách cột riêng (bảng web, sheet Excel, CSV sao lưu), nên
 * sửa một chỗ là chỗ khác lệch — đã từng làm sheet "Tổng quát đầu ra" hiện MST công ty mình lặp
 * mọi dòng thay vì MST khách hàng. Nay mọi kênh đọc cùng một mảng cột nên không lệch được nữa.
 */
import type { ReactNode } from "react";
import { formatMoney } from "../format";

/** 1 cột hóa đơn. Kênh nào cần thuộc tính gì thì đọc thuộc tính đó. */
export interface InvoiceColumn<T> {
  /** Khóa ổn định — React key + tra cứu cột. KHÔNG đổi khi đổi tiêu đề. */
  key: string;
  /** Tiêu đề: hàng 1 của sheet Excel, dòng tiêu đề CSV, `<TableCell>` đầu bảng web. */
  header: string;
  /** Độ rộng cột Excel (đơn vị ký tự). Bỏ trống = để Excel tự co; kênh web và CSV không đọc. */
  width?: number;
  /** Căn lề ô trên web. Kênh file không đọc. */
  align?: "right" | "center";
  /** numFmt kiểu Excel cho cột số (vd "#,##0"). Có numFmt = cột số, web tự gọi `formatMoney`. */
  numFmt?: string;
  /**
   * Giá trị THÔ của ô (`stt` = số thứ tự 1-based). Excel/CSV dùng thẳng — cột số phải trả `number`
   * để Excel còn cộng/lọc được. Trả `undefined` cho ô không có dữ liệu: file xuất ghi ô TRỐNG
   * (không phải 0), web hiện `NO_DATA_YET`.
   */
  value: (row: T, stt: number) => string | number | undefined;
  /** Ghi đè hoàn toàn cách render trên web (ô có màu…). Kênh file không đọc. */
  cell?: (row: T, stt: number) => ReactNode;
  /** Chỉ hiện trên web, không xuất ra file — `fileColumns` lọc bỏ. */
  webOnly?: boolean;
}

/** Cột chưa có nguồn dữ liệu (cần API/tính năng riêng, chưa xây) — web hiện tạm "—". */
export const NO_DATA_YET = "—";

// --- numFmt dùng lại nhiều lần trong các file khai báo cột ---
export const MONEY_FMT = "#,##0";
export const NUM_FMT = "#,##0.##";

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

/** Bỏ cột chỉ dành cho web — mọi kênh ghi ra file (Excel, CSV) phải đi qua hàm này. */
export function fileColumns<T>(cols: InvoiceColumn<T>[]): InvoiceColumn<T>[] {
  return cols.filter((c) => !c.webOnly);
}

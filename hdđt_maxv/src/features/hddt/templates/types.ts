/**
 * "Template cột" — khai báo cột hóa đơn MỘT LẦN, dùng chung cho bảng trên web và file Excel/CSV.
 *
 * Trước đây mỗi đầu ra tự khai một danh sách cột riêng (bảng web, sheet Excel, CSV sao lưu), nên
 * sửa một chỗ là chỗ khác lệch — đã từng làm sheet "Tổng quát đầu ra" hiện MST công ty mình lặp
 * mọi dòng thay vì MST khách hàng. Nay mọi kênh đọc cùng một mảng cột nên không lệch được nữa.
 */
import type { ReactNode } from "react";
import { formatMoney } from "../format";

/** Kiểu tô 1 hàng Excel. Màu dạng ARGB 8 ký tự của exceljs ("FF" + RRGGBB). */
export interface ExcelCellStyle {
  /** Màu nền. */
  bg: string;
  /** Màu chữ — bỏ trống thì giữ màu chữ mặc định. */
  fg?: string;
}

/**
 * Màu tô CẢ HÀNG của hóa đơn theo mã trạng thái `tthai`.
 *
 * Ý NGHĨA MÃ nằm ở `TRANG_THAI_HD_OPTIONS` (`api/gdt.ts`) — đây chỉ là phần trình bày, nên KHÔNG
 * lặp lại nhãn ở đây; thêm mã mới thì thêm cả hai chỗ.
 *
 * Mã `1` (Hóa đơn mới) CỐ Ý không có màu: đó là đa số tuyệt đối, tô hết thì màu mất tác dụng báo
 * hiệu. Chỉ tô các trạng thái đã BIẾN ĐỘNG, đậm dần theo mức nghiêm trọng — hủy là đỏ.
 *
 * Màu phải NHẠT: nó phủ hết bề ngang bảng (46 cột) chứ không phải một ô, nền đậm sẽ nuốt chữ đen.
 * Riêng mã `6` thêm màu CHỮ đỏ sẫm — vẫn thừa tương phản trên nền hồng nhạt.
 */
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
export function trangThaiHdRowFill(row: { trangThaiHd: string }): ExcelCellStyle | undefined {
  return TRANG_THAI_HD_FILL[row.trangThaiHd];
}

/** Màu xám nhạt cho cảnh báo (thiếu địa chỉ người mua, v.v.) */
export const WARNING_FILL: ExcelCellStyle = { bg: "FFE0E0E0" }; // xám nhạt

/**
 * Tô cả hàng kết hợp: Ưu tiên trạng thái hóa đơn, nếu không có mới dùng warning.
 *
 * Dùng cho CẢ BỐN chỗ hiển thị hóa đơn — 2 bảng trên web (Tổng quát + Chi tiết, qua `rowFillSx`) và
 * 2 sheet Excel tương ứng — nên một hóa đơn luôn cùng màu ở mọi nơi. Tham số nhận structural type
 * (`DisplayRow` lẫn `DetailRow` đều khớp) chứ không buộc một kiểu cụ thể.
 */
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
   * Ép ô thành CHỮ trong Excel (numFmt "@") — cho cột ngày dd/MM/yyyy và mã số, để Excel khỏi tự
   * đoán kiểu rồi đổi "02/01/2026" thành ngày kiểu Mỹ hay cắt số 0 đứng đầu.
   *
   * Cố ý KHÔNG dùng chung `numFmt`: `renderCell` hiểu "có numFmt = cột số" nên nhét "@" vào đó sẽ
   * làm bảng web đem chuỗi ngày đi `formatMoney` và hiện ô trống. Kênh web bỏ qua cờ này.
   */
  excelText?: boolean;
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
  /**
   * Cột được CỘNG ở hàng tổng cuối bảng (xem `tongCotSo`). Chỉ bật cho cột tiền — cột số lượng, tỷ
   * giá, thuế suất… cộng lại không có nghĩa gì.
   */
  total?: boolean;
}

/** Cột chưa có nguồn dữ liệu (cần API/tính năng riêng, chưa xây) — web hiện tạm "—". */
export const NO_DATA_YET = "—";

/**
 * --- numFmt dùng lại nhiều lần trong các file khai báo cột ---
 *
 * QUY TẮC BẤT DI BẤT DỊCH: định dạng ở đây KHÔNG ĐƯỢC LÀM TRÒN. Excel làm tròn theo số chữ số mà
 * numFmt cho phép, nên `#,##0.0` sẽ biến 9,69 thành 9,7 — sai số liệu hóa đơn ngay trên màn hình
 * kế toán dù ô vẫn giữ giá trị đúng. Vì vậy mọi định dạng đều có ĐUÔI `#` dự phòng:
 *   `0` = chữ số bắt buộc (hiện cả khi bằng 0) · `#` = chữ số chỉ hiện khi có
 * -> phần nguyên và 2 số lẻ đầu luôn hiện (đúng dáng mẫu Excel của kế toán), các số lẻ sau đó chỉ
 * hiện khi hóa đơn thực sự có, và KHÔNG có chữ số nào bị cắt.
 *
 * Lưu ý: Excel format code không hỗ trợ đổi thousand separator sang dấu chấm (.).
 * Format bên dưới dùng dấu phẩy (,) cho thousand separator theo chuẩn Excel.
 * Để hiển thị dấu chấm trên Excel, cần thay đổi Region Settings của hệ thống.
 */
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

/** Bỏ cột chỉ dành cho web — mọi kênh ghi ra file (Excel, CSV) phải đi qua hàm này. */
export function fileColumns<T>(cols: InvoiceColumn<T>[]): InvoiceColumn<T>[] {
  return cols.filter((c) => !c.webOnly);
}

/** Nhãn ở ô đầu tiên của hàng tổng. */
export const TOTAL_ROW_LABEL = "TỔNG CỘNG";

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

/**
 * Template cột hóa đơn — nguồn khai báo cột DUY NHẤT cho bảng web và file Excel/CSV.
 *
 * MỖI CHIỀU MỘT FILE:
 *   dauVao.ts  →  cột Tổng quát + Chi tiết của hóa đơn ĐẦU VÀO (2 sheet của Tong-hop-dau-vao.xlsx)
 *   dauRa.ts   →  cột Tổng quát + Chi tiết của hóa đơn ĐẦU RA  (2 sheet của Tong-hop-dau-ra.xlsx)
 *
 * Sửa cột của một chiều: mở đúng file của chiều đó. Cột dùng chung cả hai chiều phải sửa CẢ HAI.
 * Nếu cột cần dữ liệu mới, thêm field vào `DisplayRow`/`DetailRow` trong `../types` trước.
 *
 * File này CỐ Ý không re-export `overviewDauVao`/`overviewDauRa`…: nơi gọi chỉ được lấy cột qua
 * `overviewColumns(direction)` để không ai hardcode được một chiều rồi lệch chiều quay lại.
 */
import type { DetailRow, DisplayRow, InvoiceDirection } from "../types";
import { detailDauVao, overviewDauVao } from "./dauVao";
import { detailDauRa, overviewDauRa } from "./dauRa";
import type { InvoiceColumn } from "./types";

/** Cột bảng "Tổng quát" theo chiều — bảng web `InvoiceListTabs` + sheet Excel 1. */
export function overviewColumns(direction: InvoiceDirection): InvoiceColumn<DisplayRow>[] {
  return direction === "purchase" ? overviewDauVao() : overviewDauRa();
}

/** Cột bảng "Chi tiết hóa đơn" theo chiều — bảng web `InvoiceDetailPanel` + sheet Excel 2. */
export function detailColumns(direction: InvoiceDirection): InvoiceColumn<DetailRow>[] {
  return direction === "purchase" ? detailDauVao() : detailDauRa();
}

export { backupColumns } from "./backupColumns";
export { fileColumns, renderCell, type InvoiceColumn } from "./types";
/** Hàng tổng cuối bảng: `TotalsRow` cho web, `tongCotSo` cho sheet Excel — cùng một phép cộng. */
export { totalsRow } from "./cells";
export { tongCotSo, TOTAL_ROW_LABEL, TOTAL_TEXT_ARGB } from "./types";
/** Màu hàng theo trạng thái/cảnh báo: `invoiceRowFill` cho ra màu, `rowFillSx` biến nó thành sx của bảng web. */
export { invoiceRowFill } from "./types";
export { rowFillSx } from "./cells";

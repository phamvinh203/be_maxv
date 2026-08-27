/**
 * Ô render riêng cho BẢNG TRÊN WEB (có màu, có icon…) — dùng ở thuộc tính `cell` của cột.
 * Tách khỏi `dauVao`/`dauRa` để hai file khai báo cột thuần dữ liệu (.ts, không JSX).
 */
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import { darken, type SxProps, type Theme } from "@mui/material/styles";
import { formatMoney, ttTaiLabel } from "../format";
import {
  NO_DATA_YET,
  TOTAL_ROW_LABEL,
  TOTAL_TEXT_ARGB,
  TRANG_THAI_HD_FILL,
  WARNING_FILL,
  columnCellSx,
  type ExcelCellStyle,
  type InvoiceColumn,
} from "./types";

// Hằng ngoài hàm: object `sx` mới mỗi ô sẽ bắt emotion serialize lại cho từng dòng của bảng.
const TT_TAI_OK_SX = { color: "success.main", fontWeight: 600 };
const TT_TAI_ERR_SX = { color: "error.main", fontWeight: 600 };

/** Ô "T. thái tải": OK (xanh) / Lỗi (đỏ) theo `tt_tai`; chưa tải -> "—". */
export function ttTaiCell(v?: string): ReactNode {
  const label = ttTaiLabel(v);
  if (!label) return NO_DATA_YET;
  return (
    <Box component="span" sx={v === "OK" ? TT_TAI_OK_SX : TT_TAI_ERR_SX}>
      {label}
    </Box>
  );
}

/**
 * Màu CHỮ mặc định của hàng CÓ nền tô. Không để chữ đi theo theme: mọi màu nền trong
 * `TRANG_THAI_HD_FILL`/`WARNING_FILL` đều rất nhạt (chọn cho nền trắng của Excel), nên ở CHẾ ĐỘ TỐI
 * chữ sáng mặc định của theme sẽ nằm trên nền pastel — gần như không đọc được.
 */
const FILLED_ROW_TEXT = "#1C1C1C";

/** Sắc độ tối thêm khi rê chuột — giữ được màu trạng thái của hàng thay vì bị lớp phủ hover nuốt mất. */
const HOVER_DARKEN = 0.08;

/** ARGB 8 ký tự của exceljs ("FFDDEBF7") -> mã màu CSS ("#DDEBF7"). */
function argbToCss(argb: string): string {
  return `#${argb.slice(-6)}`;
}

/**
 * Hàng TỔNG: chữ đỏ, in đậm, gạch dưới đậm để tách hẳn khỏi vùng dữ liệu bên dưới; nền
 * `background.paper` PHẢI đục vì hàng này dính (`position: sticky`) — dữ liệu cuộn qua bên dưới mà
 * nền trong suốt thì sẽ nhìn xuyên qua được, chữ chồng lên nhau.
 *
 * `stickyTop` = chiều cao thật của hàng tiêu đề đang dính phía trên nó (đo bằng `useElementHeight`
 * ở nơi gọi, xem `InvoiceListTabs`/`InvoiceDetailPanel`) — hàng tổng dính NGAY DƯỚI mép hàng tiêu
 * đề, không hardcode px vì tiêu đề có thể 1 hay 2 dòng tùy `webWidth` của bộ cột.
 */
function totalRowSx(stickyTop: number): SxProps<Theme> {
  return {
    position: "sticky",
    top: stickyTop,
    zIndex: 1,
    "& td": {
      color: argbToCss(TOTAL_TEXT_ARGB),
      fontWeight: 700,
      borderBottom: "2px solid",
      borderBottomColor: "divider",
      bgcolor: "background.paper",
    },
  };
}

/**
 * Hàng tổng ĐẦU bảng web (ngay dưới hàng tiêu đề) — DÍNH lại khi cuộn dọc, ngay dưới hàng tiêu đề
 * cũng đang dính (`stickyHeader` của MUI), nên luôn thấy được dù cuộn xuống dòng thứ mấy.
 *
 * NHẬN SẴN `tong` (từ `tongCotSo`) chứ không tự cộng: phép cộng chạy qua TOÀN BỘ hàng của bảng — chi
 * tiết một tháng là hàng chục nghìn dòng × 8 cột tiền — còn component thì render lại theo mọi state
 * của màn hình (lật trang, tick chọn, mỗi nhịp poll lúc đang tải chi tiết). Nơi gọi bọc `useMemo` để
 * phép cộng chỉ chạy lại khi `rows`/`columns` thật sự đổi.
 *
 * Là HÀM trả `ReactNode` chứ không phải component — cùng thành ngữ với `renderCell`/`ttTaiCell`, và
 * nhờ vậy file này giữ nguyên vai trò "kho hàm render", không lẫn component (fast-refresh).
 */
export function totalsRow<T>(
  columns: InvoiceColumn<T>[],
  tong: Map<string, number>,
  stickyTop: number,
): ReactNode {
  // Nhãn gộp (colSpan) từ cột đầu tới ngay trước cột `total` đầu tiên — các cột đó vốn trống ở hàng
  // này (không có số liệu). Gộp thay vì nhét vào riêng cột đầu: cột đầu thường là STT, `webWidth`
  // hẹp của nó (canh cho số 1-2 chữ số) không đủ chỗ cho "TỔNG CỘNG", chữ sẽ bị bẻ ngang giữa từ.
  const firstTotalIdx = columns.findIndex((c) => c.total);
  // `Math.max(…, 1)`: nếu 1 ngày nào đó cột `total` đầu tiên rơi đúng vị trí 0 (hiện chưa xảy ra —
  // cột 0 luôn là STT/mauHd), `colSpan={0}` là HTML không hợp lệ; span tối thiểu 1 tránh vỡ bảng.
  const labelSpan = firstTotalIdx === -1 ? columns.length : Math.max(firstTotalIdx, 1);
  return (
    <TableRow sx={totalRowSx(stickyTop)}>
      <TableCell colSpan={labelSpan} sx={{ whiteSpace: "nowrap" }}>
        {TOTAL_ROW_LABEL}
      </TableCell>
      {columns.slice(labelSpan).map((col) => (
        <TableCell key={col.key} align={col.align} sx={columnCellSx(col)}>
          {tong.has(col.key) ? formatMoney(tong.get(col.key)) : ""}
        </TableCell>
      ))}
    </TableRow>
  );
}

/**
 * Dựng `sx` cho một màu nền — đối tượng `sx` mới mỗi ô sẽ bắt emotion serialize lại cho TỪNG DÒNG
 * của bảng (hàng nghìn dòng mỗi lần render), nên chúng được dựng SẴN một lần ở `SX_THEO_FILL`.
 *
 * Tự đặt lại màu hover: lớp phủ hover mặc định của MUI là màu BÁN TRONG SUỐT ghi đè
 * `background-color`, nên nó hòa với nền giấy phía sau chứ không phải với màu vừa tô — rê chuột vào
 * là hàng mất màu trạng thái.
 */
function sxTuFill(fill: ExcelCellStyle): SxProps<Theme> {
  const bg = argbToCss(fill.bg);
  return {
    bgcolor: bg,
    "&:hover": { bgcolor: darken(bg, HOVER_DARKEN) },
    // Màu chữ phải đặt ở Ô: `MuiTableCell` tự khai `color` nên không thừa hưởng từ hàng.
    "& td": { color: fill.fg ? argbToCss(fill.fg) : FILLED_ROW_TEXT },
  };
}

/**
 * Toàn bộ màu hàng có thể xảy ra, dựng sẵn lúc nạp module. Khóa bằng CHÍNH đối tượng `ExcelCellStyle`
 * chứ không phải chuỗi màu: `invoiceRowFill` luôn trả về đúng các tham chiếu trong bảng này, nên tra
 * theo identity vừa đúng vừa khỏi phải nối chuỗi khóa cho mỗi dòng.
 */
const SX_THEO_FILL = new Map<ExcelCellStyle, SxProps<Theme>>(
  [...Object.values(TRANG_THAI_HD_FILL), WARNING_FILL].map((fill) => [fill, sxTuFill(fill)]),
);

/**
 * `sx` cho `<TableRow>` tô cả hàng trên web, đọc CÙNG bảng màu với file Excel (`ExcelCellStyle` —
 * xem `invoiceRowFill`) nên bảng web và sheet Excel không thể lệch màu nhau.
 * `undefined` = hàng không có màu (hóa đơn mới, không cảnh báo) -> để nguyên nền theo theme.
 */
export function rowFillSx(fill: ExcelCellStyle | undefined): SxProps<Theme> | undefined {
  return fill && SX_THEO_FILL.get(fill);
}

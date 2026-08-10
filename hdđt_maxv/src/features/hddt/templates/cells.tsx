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
  tongCotSo,
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
 * Hàng TỔNG: chữ đỏ, in đậm, gạch dưới đậm để tách hẳn khỏi vùng dữ liệu bên dưới. Không tô nền —
 * hàng dữ liệu kế nó có thể đang có màu trạng thái, thêm nền nữa là rối.
 */
const TOTAL_ROW_SX: SxProps<Theme> = {
  "& td": {
    color: argbToCss(TOTAL_TEXT_ARGB),
    fontWeight: 700,
    borderBottom: "2px solid",
    borderBottomColor: "divider",
  },
};

/**
 * Hàng tổng ĐẦU bảng web (ngay dưới hàng tiêu đề) — cộng các cột có cờ `total` trên TOÀN BỘ `rows`,
 * tức toàn bộ hóa đơn khớp bộ lọc chứ KHÔNG phải riêng trang đang xem (nơi gọi truyền `rows` đầy đủ,
 * không phải `pagedRows`). Vì vậy con số giữ nguyên khi lật trang, và khớp đúng hàng tổng của sheet
 * Excel. Đặt trên đầu để thấy ngay khi mở bảng, không phải cuộn xuống cuối.
 *
 * Là HÀM trả `ReactNode` chứ không phải component — cùng thành ngữ với `renderCell`/`ttTaiCell`, và
 * nhờ vậy file này giữ nguyên vai trò "kho hàm render", không lẫn component (fast-refresh).
 */
export function totalsRow<T>(columns: InvoiceColumn<T>[], rows: T[]): ReactNode {
  const tong = tongCotSo(columns, rows);
  return (
    <TableRow sx={TOTAL_ROW_SX}>
      {columns.map((col, i) => (
        <TableCell key={col.key} align={col.align}>
          {i === 0 ? TOTAL_ROW_LABEL : tong.has(col.key) ? formatMoney(tong.get(col.key)) : ""}
        </TableCell>
      ))}
    </TableRow>
  );
}

/**
 * Cache theo cặp màu: `sx` là object mới mỗi lần gọi thì emotion serialize lại cho TỪNG DÒNG của
 * bảng (hàng nghìn dòng mỗi lần render). Cả bảng chỉ có vài màu nên cache là đủ.
 */
const rowSxCache = new Map<string, SxProps<Theme>>();

/**
 * `sx` cho `<TableRow>` tô cả hàng trên web, đọc CÙNG bảng màu với file Excel (`ExcelCellStyle` —
 * xem `invoiceRowFill`) nên bảng web và sheet Excel không thể lệch màu nhau.
 * `undefined` = hàng không có màu (hóa đơn mới, không cảnh báo) -> để nguyên nền theo theme.
 *
 * Tự đặt lại màu hover: lớp phủ hover mặc định của MUI là màu BÁN TRONG SUỐT ghi đè
 * `background-color`, nên nó hòa với nền giấy phía sau chứ không phải với màu vừa tô — rê chuột vào
 * là hàng mất màu trạng thái.
 */
export function rowFillSx(fill: ExcelCellStyle | undefined): SxProps<Theme> | undefined {
  if (!fill) return undefined;
  const key = `${fill.bg}|${fill.fg ?? ""}`;
  const cached = rowSxCache.get(key);
  if (cached) return cached;

  const bg = argbToCss(fill.bg);
  const sx: SxProps<Theme> = {
    bgcolor: bg,
    "&:hover": { bgcolor: darken(bg, HOVER_DARKEN) },
    // Màu chữ phải đặt ở Ô: `MuiTableCell` tự khai `color` nên không thừa hưởng từ hàng.
    "& td": { color: fill.fg ? argbToCss(fill.fg) : FILLED_ROW_TEXT },
  };
  rowSxCache.set(key, sx);
  return sx;
}

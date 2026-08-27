import { useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import InboxRounded from "@mui/icons-material/InboxRounded";
import InvoicePagination, { DEFAULT_ROWS_PER_PAGE } from "../../../components/InvoicePagination";
import { clampPage } from "../../../utils/pagination";
import { columnDividerSx } from "../../../utils/tableStyles";
import { useElementHeight } from "../hooks/useElementHeight";
import {
  columnCellSx,
  detailColumns,
  headerAlign,
  invoiceRowFill,
  renderCell,
  rowFillSx,
  tongCotSo,
  totalsRow,
} from "../templates";
import type { DetailRow, InvoiceDirection } from "../types";

/** Khung căn giữa dùng cho trạng thái loading / gợi ý (viền + bo góc như placeholder cũ). */
function CenteredState({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        py: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        color: "text.disabled",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
      {children}
    </Box>
  );
}

interface Props {
  /** Các dòng chi tiết (đã bung hàng hóa) của TẤT CẢ hóa đơn trong khoảng đang xem — ĐÃ lọc/sắp
   * xếp xong ở `InvoiceListTabs` (bảng này chỉ hiển thị + tự phân trang). */
  rows: DetailRow[];
  /** Chiều hóa đơn — quyết định cột đối tác (mua vào: người bán; bán ra: người mua). */
  direction: InvoiceDirection;
  loading: boolean;
  /** Lỗi đọc chi tiết đã lưu. */
  error: string;
  /**
   * Icon SẮP XẾP cạnh tên cột — cha sở hữu toàn bộ state (sort/filter), bảng này chỉ vẽ chỗ đứng
   * theo `col.key` + truyền kèm `col.header` (để popover hiện đúng tên cột thật, không phải label
   * gõ tay lệch chữ). `undefined` = không có icon nào (cột không sort được).
   */
  renderHeaderExtra?: (colKey: string, header: string) => ReactNode;
  /** Ô lọc dòng CỐ ĐỊNH ngay dưới header — cùng nguyên tắc `renderHeaderExtra` nhưng không cần
   * `header` (ô input không hiện lại tên cột). `undefined`/không truyền = không có dòng lọc nào. */
  renderHeaderInputExtra?: (colKey: string) => ReactNode;
}

/**
 * Bảng "Chi tiết hóa đơn" — nội dung tab "Chi tiết hoá đơn" trong `InvoiceListTabs`.
 * Hiển thị tất cả dòng hàng hóa của mọi hóa đơn đã tải chi tiết trong khoảng đang xem.
 * Cột khai ở `templates/detailColumns` — dùng chung với sheet Excel "Chi tiết".
 */
export default function InvoiceDetailPanel({
  rows,
  direction,
  loading,
  error,
  renderHeaderExtra,
  renderHeaderInputExtra,
}: Props) {
  // Phân trang phía client (độc lập với tab "Tổng quát"): dùng chung InvoicePagination.
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  const columns = useMemo(() => detailColumns(direction), [direction]);
  // Chiều cao thật của hàng tiêu đề (1 hay 2 dòng tùy `webWidth`) -> canh `top` cho hàng tổng dính
  // ngay dưới nó, xem `totalsRow`.
  const [headerRowRef, headerRowHeight] = useElementHeight<HTMLTableRowElement>();
  // Cộng trên TOÀN BỘ `rows` (hàng chục nghìn dòng hàng × 8 cột tiền) nên phải nhớ kết quả: bảng này
  // render lại theo mọi nhịp poll của lượt "Tải chi tiết", chứ không chỉ khi dữ liệu đổi.
  const tong = useMemo(() => tongCotSo(columns, rows), [columns, rows]);

  if (loading) {
    return (
      <CenteredState>
        <CircularProgress />
        <Typography variant="body2">Đang tải chi tiết hóa đơn…</Typography>
      </CenteredState>
    );
  }
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 1 }}>
        {error}
      </Alert>
    );
  }
  if (rows.length === 0) {
    return (
      <CenteredState>
        <InboxRounded fontSize="large" />
        <Typography variant="body2">
          Chưa có chi tiết. Bấm &quot;Tải chi tiết&quot; để tải từ Thuế điện tử.
        </Typography>
      </CenteredState>
    );
  }

  // Kẹp trang trong khoảng hợp lệ (dữ liệu đổi sau khi tải lại -> khỏi kẹt ở trang trống).
  const safePage = clampPage(page, rows.length, rowsPerPage);
  const pagedRows = rows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  return (
    <>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520, overflowX: "auto" }}>
        <Table
          size="small"
          stickyHeader
          sx={(theme) => columnDividerSx(theme)}
        >
          <TableHead>
            <TableRow ref={headerRowRef} sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
              {columns.map((col) => (
                <TableCell key={col.key} align={headerAlign(col)} sx={columnCellSx(col)}>
                  {col.header}
                  {renderHeaderExtra?.(col.key, col.header)}
                </TableCell>
              ))}
            </TableRow>
            {renderHeaderInputExtra && (
              // Dòng lọc CỐ ĐỊNH dưới header — thay popover cũ, luôn hiện sẵn 1 ô/cột (rỗng nếu cột
              // không lọc được). `position: "static"` để BỎ hiệu ứng dính-khi-cuộn-dọc mà `stickyHeader`
              // áp cho MỌI ô trong `TableHead` — chỉ dòng tiêu đề dính, dòng lọc cuộn theo thân bảng
              // (cùng cách `BangHoSo.tsx` bên Dịch vụ công đang làm).
              <TableRow sx={{ "& th": { bgcolor: "action.hover", py: 0.25 } }}>
                {columns.map((col) => (
                  <TableCell key={col.key} align={col.align} sx={{ position: "static", ...columnCellSx(col) }}>
                    {renderHeaderInputExtra(col.key)}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableHead>
          <TableBody>
            {/* Hàng tổng đứng NGAY DƯỚI tiêu đề. `rows` (toàn bộ dòng khớp bộ lọc), KHÔNG phải
                `pagedRows`: đây là tổng của cả bảng nên không đổi khi lật trang — cũng là con số
                nằm ở sheet Excel. */}
            {totalsRow(columns, tong, headerRowHeight)}
            {pagedRows.map((r, i) => {
              const stt = safePage * rowsPerPage + i + 1;
              return (
                // Tô cả hàng theo trạng thái/cảnh báo — CÙNG bảng màu với sheet Excel "Chi tiết".
                <TableRow key={stt} hover sx={rowFillSx(invoiceRowFill(r))}>
                  {columns.map((col) => (
                    <TableCell key={col.key} align={col.align} sx={columnCellSx(col)}>
                      {renderCell(col, r, stt)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <InvoicePagination
        count={rows.length}
        page={safePage}
        rowsPerPage={rowsPerPage}
        onPageChange={setPage}
        onRowsPerPageChange={(value) => {
          setRowsPerPage(value);
          setPage(0);
        }}
      />
    </>
  );
}

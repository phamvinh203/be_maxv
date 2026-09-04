import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import InboxRounded from "@mui/icons-material/InboxRounded";
import { overviewToKhai } from "../../templates/cotBangKe";
import { useBangKeQuery } from "../../api/toKhaiQueries";
import { nhanKy, type Ky, type ToKhaiRow } from "../../ky";
import { toDisplayRow } from "../../../hddt/invoiceRow";
import { buildReplacedByMap } from "../../../hddt/detailRow";
import { useElementHeight } from "../../../hddt/hooks/useElementHeight";
import { columnCellSx, headerAlign, renderCell, tongCotSo, totalsRow } from "../../../hddt/templates";
import type { InvoiceDirection } from "../../../hddt/types";
import InvoicePagination, { DEFAULT_ROWS_PER_PAGE } from "../../../../components/InvoicePagination";
import { clampPage } from "../../../../utils/pagination";
import { columnDividerSx } from "../../../../utils/tableStyles";
import { getErrorMessage } from "../../../../lib/errors";

interface BangKeMotChieuProps {
  ky: Ky;
  direction: InvoiceDirection;
  /** Tab ẩn vẫn giữ phân trang nhưng không gọi API. */
  active: boolean;
}

/** Bảng kê của một chiều hóa đơn, bao gồm dữ liệu, phân trang và hàng tổng của chính bảng đó. */
export default function BangKeMotChieu({
  ky,
  direction,
  active,
}: BangKeMotChieuProps): ReactElement {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  const [headerRowRef, headerRowHeight] = useElementHeight<HTMLTableRowElement>();
  const bangKe = useBangKeQuery(ky, direction, active);
  const columns = useMemo(() => overviewToKhai(direction), [direction]);

  const replacedBy = useMemo(
    () => buildReplacedByMap(bangKe.data?.thayThe ?? []),
    [bangKe.data],
  );

  const rows: ToKhaiRow[] = useMemo(() => {
    const nhan = nhanKy(ky);
    return (bangKe.data?.datas ?? []).map((row) => ({
      ...toDisplayRow(row, direction, replacedBy),
      chieu: direction,
      keKhai: row.keKhai,
      chiTieuTangGiam: row.chiTieuTangGiam,
      nam: String(ky.nam),
      kyKeKhai: nhan,
    }));
  }, [bangKe.data, direction, replacedBy, ky]);

  const tong = useMemo(() => tongCotSo(columns, rows), [columns, rows]);
  const safePage = clampPage(page, rows.length, rowsPerPage);
  const pagedRows = rows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  return (
    <Box>
      {bangKe.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getErrorMessage(bangKe.error, "Không đọc được bảng kê của kỳ.")}
        </Alert>
      )}

      <Paper variant="outlined">
        <TableContainer sx={{ maxHeight: "62vh" }}>
          <Table size="small" stickyHeader sx={(theme) => columnDividerSx(theme)}>
            <TableHead>
              <TableRow ref={headerRowRef}>
                {columns.map((col) => (
                  <TableCell key={col.key} align={headerAlign(col)} sx={columnCellSx(col)}>
                    {col.header}
                  </TableCell>
                ))}
              </TableRow>
              {rows.length > 0 && totalsRow(columns, tong, headerRowHeight)}
            </TableHead>
            <TableBody>
              {pagedRows.map((row, index) => (
                <TableRow key={row.id} hover>
                  {columns.map((col) => (
                    <TableCell key={col.key} align={col.align} sx={columnCellSx(col)}>
                      {renderCell(col, row, safePage * rowsPerPage + index + 1)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {pagedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    <Stack sx={{ alignItems: "center", py: 4 }} spacing={1}>
                      {bangKe.isFetching ? (
                        <CircularProgress size={28} />
                      ) : (
                        <>
                          <InboxRounded fontSize="large" color="disabled" />
                          <Typography variant="body2" color="text.secondary">
                            Kỳ {nhanKy(ky)} chưa có hóa đơn nào được kê khai.
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Sang màn Hóa đơn điện tử, bấm “Kê khai” và chọn kỳ này.
                          </Typography>
                        </>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <InvoicePagination
          count={rows.length}
          page={safePage}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={(nextRowsPerPage) => {
            setRowsPerPage(nextRowsPerPage);
            setPage(0);
          }}
        />
      </Paper>
    </Box>
  );
}

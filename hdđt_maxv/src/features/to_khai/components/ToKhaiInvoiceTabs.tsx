import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
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
import ChonKyPanel from "./ChonKyPanel";
import { overviewColumnsToKhai } from "../templates";
import { useBangKeQuery } from "../api/toKhaiQueries";
import { kyToQuery, kyTuQuery, nhanKy, type Ky, type ToKhaiRow } from "../ky";
import { toDisplayRow } from "../../hddt/invoiceRow";
import { buildReplacedByMap } from "../../hddt/detailRow";
import { useElementHeight } from "../../hddt/hooks/useElementHeight";
import {
  columnCellSx,
  headerAlign,
  renderCell,
  tongCotSo,
  totalsRow,
} from "../../hddt/templates";
import type { InvoiceDirection } from "../../hddt/types";
import InvoicePagination, { DEFAULT_ROWS_PER_PAGE } from "../../../components/InvoicePagination";
import { clampPage } from "../../../utils/pagination";
import { columnDividerSx } from "../../../utils/tableStyles";
import { getErrorMessage } from "../../../lib/errors";

interface BangProps {
  ky: Ky;
  direction: InvoiceDirection;
  /** Tab này đang hiển thị hay không — tab ẩn vẫn giữ state nhưng KHÔNG gọi API. */
  active: boolean;
}

/**
 * Bảng kê một chiều của một kỳ: hóa đơn ĐÃ ĐƯỢC GÁN vào kỳ (qua nút "Kê khai" bên màn Hóa đơn
 * điện tử), dựng bằng bộ cột riêng của mô-đun này.
 *
 * Cột "Năm" và "Kỳ kê khai" lấy từ KỲ ĐANG XEM chứ không suy từ ngày lập hóa đơn: kỳ là quyết
 * định của kế toán, mà từ ngày lập thì không biết công ty khai theo tháng hay quý.
 */
function BangKeMotChieu({ ky, direction, active }: BangProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  // Chiều cao thật của hàng tiêu đề -> canh `top` cho hàng tổng dính ngay dưới nó khi cuộn.
  const [headerRowRef, headerRowHeight] = useElementHeight<HTMLTableRowElement>();

  const bangKe = useBangKeQuery(ky, direction, active);
  const columns = useMemo(() => overviewColumnsToKhai(direction), [direction]);

  /**
   * Bản đồ ngược "hóa đơn này bị hóa đơn nào thay thế/điều chỉnh". BẮT BUỘC truyền vào
   * `toDisplayRow`: payload của hóa đơn BỊ thay thế (tthai=4) / BỊ điều chỉnh (tthai=5) không mang
   * field nào trỏ tới tờ thay nó — chỉ tờ thay thế mới biết tờ gốc. Thiếu map này thì hai cột ghi
   * chú điều chỉnh/thay thế trống oan đúng ở những dòng cần nhìn nhất.
   */
  const replacedBy = useMemo(
    () => buildReplacedByMap(bangKe.data?.thayThe ?? []),
    [bangKe.data],
  );

  const rows: ToKhaiRow[] = useMemo(() => {
    const nhan = nhanKy(ky);
    return (bangKe.data?.datas ?? []).map((r) => ({
      ...toDisplayRow(r, direction, replacedBy),
      keKhai: r.keKhai,
      chiTieuTangGiam: r.chiTieuTangGiam,
      nam: String(ky.nam),
      kyKeKhai: nhan,
    }));
  }, [bangKe.data, direction, replacedBy, ky]);

  // Cộng trên TOÀN BỘ dòng (không chỉ trang đang xem) — hàng tổng phải khớp kỳ, không khớp trang.
  const tong = useMemo(() => tongCotSo(columns, rows), [columns, rows]);

  // Kẹp trang trong khoảng hợp lệ: đổi kỳ xong dữ liệu ít đi thì khỏi kẹt ở trang trống.
  const safePage = clampPage(page, rows.length, rowsPerPage);
  const pagedRows = rows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  const dangTai = bangKe.isFetching;

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
              {pagedRows.map((row, i) => (
                <TableRow key={row.id} hover>
                  {columns.map((col) => (
                    <TableCell key={col.key} align={col.align} sx={columnCellSx(col)}>
                      {renderCell(col, row, safePage * rowsPerPage + i + 1)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {pagedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    <Stack sx={{ alignItems: "center", py: 4 }} spacing={1}>
                      {dangTai ? (
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
          onRowsPerPageChange={(n) => {
            setRowsPerPage(n);
            setPage(0);
          }}
        />
      </Paper>
    </Box>
  );
}

/**
 * Hai tab "Mua vào" / "Bán ra" của màn Tờ khai, cùng thói quen với màn Hóa đơn điện tử.
 *
 * Kỳ sống trên QUERY STRING (`/to-khai?nam=2026&kyLoai=thang&kySo=7`) chứ không trong state: màn
 * Hóa đơn điện tử điều hướng sang đây kèm kỳ vừa kê khai, và người dùng bookmark/F5 vẫn ra đúng kỳ.
 */
export default function ToKhaiInvoiceTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ky = kyTuQuery(searchParams);
  const [tab, setTab] = useState<InvoiceDirection>("purchase");

  const doiKy = (moi: Ky) => setSearchParams(new URLSearchParams(kyToQuery(moi)));

  return (
    <Box>
      <ChonKyPanel ky={ky} onChange={doiKy} />

      <Tabs value={tab} onChange={(_e, v: InvoiceDirection) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="purchase" label="Hóa đơn mua vào" sx={{ textTransform: "none" }} />
        <Tab value="sold" label="Hóa đơn bán ra" sx={{ textTransform: "none" }} />
      </Tabs>

      {/* Mount cả hai chiều, ẩn tab không active bằng CSS — giữ số trang riêng từng chiều. */}
      <Box sx={{ display: tab === "purchase" ? "block" : "none" }}>
        <BangKeMotChieu ky={ky} direction="purchase" active={tab === "purchase"} />
      </Box>
      <Box sx={{ display: tab === "sold" ? "block" : "none" }}>
        <BangKeMotChieu ky={ky} direction="sold" active={tab === "sold"} />
      </Box>
    </Box>
  );
}

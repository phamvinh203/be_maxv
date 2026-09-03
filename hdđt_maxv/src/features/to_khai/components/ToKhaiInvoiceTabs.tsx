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
import ToKhaiGtgt01Editor from "./ToKhaiGtgt01Editor";
import DanhSachKyDaLap from "./DanhSachKyDaLap";
import { overviewToKhai } from "../templates/cotBangKe";
import { useBangKeQuery } from "../api/toKhaiQueries";
import { useBanToKhaiQuery } from "../api/gtgt01Queries";
import { KHO_GIAY_TO_KHAI } from "../layout";
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
import { ApiError } from "../../../lib/http";
import { useAuth } from "../../auth/useAuth";

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
  const columns = useMemo(() => overviewToKhai(direction), [direction]);

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
      // `chieu` đi kèm từng dòng để ô sửa quyết định gọi đúng endpoint — id GDT chỉ duy nhất
      // trong phạm vi một chiều, thiếu nó là sửa nhầm hóa đơn cùng id ở chiều kia.
      chieu: direction,
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

/** Ba tab của màn: hai bảng kê theo chiều + tờ khai của kỳ. */
type TabToKhai = InvoiceDirection | "to-khai";

/**
 * Màn Tờ khai: hai tab bảng kê ("Mua vào" / "Bán ra", cùng thói quen với màn Hóa đơn điện tử) và
 * tab "Tờ khai 01/GTGT".
 *
 * Kỳ sống trên QUERY STRING (`/to-khai?nam=2026&kyLoai=thang&kySo=7`) chứ không trong state: màn
 * Hóa đơn điện tử điều hướng sang đây kèm kỳ vừa kê khai, người dùng bookmark/F5 vẫn ra đúng kỳ,
 * và cả ba tab dùng chung một kỳ mà không phải truyền qua lại.
 */

export default function ToKhaiInvoiceTabs() {
  const { currentCompanyId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // `useMemo` vì `kyTuQuery` sinh object mới mỗi render, mà `ky` nằm trong deps của hai memo
  // dựng dòng và cột tổng — thiếu nó là dựng lại cả bảng (cả panel đang ẩn) mỗi lần re-render.
  const ky = useMemo(() => kyTuQuery(searchParams), [searchParams]);
  const [tab, setTab] = useState<TabToKhai>("purchase");
  const laToKhai = tab === "to-khai";

  const doiKy = (moi: Ky) => setSearchParams(new URLSearchParams(kyToQuery(moi)));

  const banToKhai = useBanToKhaiQuery(ky, laToKhai);

  return (
    <Box>
      {/*
        Khối chọn kỳ chỉ hiện ở hai tab BẢNG KÊ. Tab tờ khai dựng lại mẫu in khổ hẹp căn giữa —
        đặt một khối chọn kỳ viền hộp ngay trên đầu nó làm tờ khai trông như bị kẹp; ở đó kỳ rút
        còn một dòng chữ kèm nút "Đổi kỳ" (đưa về tab bảng kê).
      */}
      {!laToKhai && <ChonKyPanel ky={ky} onChange={doiKy} />}

      <Tabs value={tab} onChange={(_e, v: TabToKhai) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="purchase" label="Hóa đơn mua vào" sx={{ textTransform: "none" }} />
        <Tab value="sold" label="Hóa đơn bán ra" sx={{ textTransform: "none" }} />
        <Tab value="to-khai" label="Tờ khai 01/GTGT" sx={{ textTransform: "none" }} />
      </Tabs>

      {/* Mount cả hai chiều, ẩn tab không active bằng CSS — giữ số trang riêng từng chiều. */}
      <Box sx={{ display: tab === "purchase" ? "block" : "none" }}>
        <BangKeMotChieu ky={ky} direction="purchase" active={tab === "purchase"} />
      </Box>
      <Box sx={{ display: tab === "sold" ? "block" : "none" }}>
        <BangKeMotChieu ky={ky} direction="sold" active={tab === "sold"} />
      </Box>
      {laToKhai && (
        <>
          <ToKhaiGtgt01Editor
            // Đổi kỳ hoặc đổi công ty đang chọn phải UNMOUNT editor cũ — không thì `nhap` (ô đang
            // gõ dở, state cục bộ trong Editor) giữ nguyên số của kỳ/công ty trước, đè lên bản mới
            // vừa tải về màn hình. `switchCompany` (AuthContext) không tự remount route nào.
            key={`${currentCompanyId ?? "chua-chon"}-${nhanKy(ky)}`}
            ky={ky}
            ban={banToKhai.data ?? null}
            dangTai={banToKhai.isFetching}
            // Kỳ chưa lập trả 404 kèm code "chua_co_ban" — đó là trạng thái BÌNH THƯỜNG, hiện câu
            // chỉ đường (severity="info"). Lỗi khác (mất mạng, 500...) phải đỏ, không lẫn vào ca
            // trên — nhầm thì người dùng bấm "Lập tờ khai" tưởng kỳ chưa lập trong khi thực ra là
            // request thất bại.
            loi={
              banToKhai.isError
                ? {
                    message: getErrorMessage(
                      banToKhai.error,
                      "Kỳ này chưa có bản tờ khai nào.",
                    ),
                    severity:
                      banToKhai.error instanceof ApiError &&
                      banToKhai.error.code === "chua_co_ban"
                        ? "info"
                        : "error",
                  }
                : null
            }
            onDoiKy={() => setTab("purchase")}
          />
          {/* Cùng khổ giấy với mẫu in để hai khối thẳng mép nhau. */}
          <Box sx={{ maxWidth: KHO_GIAY_TO_KHAI, mx: "auto" }}>
            <DanhSachKyDaLap kyDangXem={ky} onChonKy={doiKy} />
          </Box>
        </>
      )}
    </Box>
  );
}

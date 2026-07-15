import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import InboxRounded from "@mui/icons-material/InboxRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import CloudDownloadRounded from "@mui/icons-material/CloudDownloadRounded";
import { useGdtSession } from "../gdtSession/useGdtSession";
import { trangThaiHdLabel, ketQuaKiemTraLabel } from "../api/gdt";
import {
  invoiceKeys,
  useFetchGdtInvoicesMutation,
  useSavedInvoicesQuery,
} from "../api/invoiceQueries";
import { detailKeys, useSavedDetailsQuery } from "../api/invoiceDetailQueries";
import { startDetailRun, getDetailRunStatus } from "../api/invoiceDetail";
import { useAuth } from "../../auth/useAuth";
import { toast } from "react-toastify";
import type {
  DisplayRow,
  InvoiceDirection,
  InvoiceFilterValues,
  InvoiceQuery,
} from "../types";
import { toDisplayRow } from "../invoiceRow";
import { toDetailRows } from "../detailRow";
import { formatMoney, ttTaiLabel } from "../format";
import InvoiceFilterPanel from "./InvoiceFilterPanel";
import InvoiceDetailPanel from "./InvoiceDetailPanel";
import InvoicePagination, { DEFAULT_ROWS_PER_PAGE } from "./InvoicePagination";
import { clampPage } from "../pagination";
import { exportDetailXlsx, exportOverviewXlsx } from "../exportXlsx";
import { currentMonthRange, formatDateVN } from "../dateUtils";
import { getErrorMessage } from "../../../lib/errors";

/** Cột chưa có nguồn dữ liệu (cần API/tính năng riêng, chưa xây) — hiển thị tạm "—". */
const NO_DATA_YET = "—";

/** 1 cột bảng "Tổng quát": tiêu đề + căn lề + hàm lấy nội dung ô từ 1 dòng (`stt` = số thứ tự). */
interface InvoiceColumn {
  header: string;
  align?: "right" | "center";
  cell: (row: DisplayRow, stt: number) => ReactNode;
}

/** Checkbox chọn dòng — hiện chỉ là placeholder (chưa có thao tác hàng loạt để gắn vào). */
const DISABLED_CHECKBOX = <Checkbox size="small" sx={{ p: 0 }} />;

/** Ô "T. thái tải": OK (xanh) / Lỗi (đỏ) theo `tt_tai`; chưa tải -> "—". */
function ttTaiCell(v?: string): ReactNode {
  const label = ttTaiLabel(v);
  if (!label) return NO_DATA_YET;
  return (
    <Box component="span" sx={{ color: v === "OK" ? "success.main" : "error.main", fontWeight: 600 }}>
      {label}
    </Box>
  );
}

/**
 * Khai báo 22 cột 1 chỗ — header và body render chung từ đây nên luôn khớp nhau.
 * Thứ tự cột theo mẫu lưới của phần mềm kế toán. Các cột chưa có nguồn dữ liệu
 * (T.thái tải, Mã ct hạch toán, Tên chứng từ hạch toán, Hóa đơn rủi ro) hiển thị tạm "—".
 */
const COLUMNS: InvoiceColumn[] = [
  { header: "STT", cell: (_r, stt) => stt },
  { header: "Chọn", align: "center", cell: () => DISABLED_CHECKBOX },
  { header: "T. thái tải", align: "center", cell: (r) => ttTaiCell(r.ttTai) },
  { header: "Ký hiệu mẫu số", cell: (r) => r.mauHd },
  { header: "Ký hiệu hóa đơn", cell: (r) => r.soSeri },
  { header: "Số hóa đơn", cell: (r) => r.soHd },
  { header: "Ngày lập", cell: (r) => formatDateVN(r.ngayLap) },
  { header: "Ngày ký", cell: (r) => formatDateVN(r.ngayKy) || NO_DATA_YET },
  { header: "MST người bán/MST người xuất hàng", cell: (r) => r.sellerMst },
  { header: "Tên người bán/Tên người xuất hàng", cell: (r) => r.sellerTen },
  { header: "Tổng tiền chưa thuế", align: "right", cell: (r) => formatMoney(r.tienChuaThue) },
  { header: "Tổng tiền thuế", align: "right", cell: (r) => formatMoney(r.tienThue) },
  { header: "Tổng CKTM", align: "right", cell: (r) => formatMoney(r.cktm) },
  { header: "Tổng phí", align: "right", cell: (r) => formatMoney(r.phi) },
  { header: "Tổng tiền thanh toán", align: "right", cell: (r) => formatMoney(r.tongTt) },
  { header: "Mã nt", cell: (r) => r.maNt },
  { header: "Tỷ giá", align: "right", cell: (r) => formatMoney(r.tyGia) },
  { header: "Trạng thái hóa đơn", align: "center", cell: (r) => trangThaiHdLabel(r.trangThaiHd) },
  { header: "Kết quả kiểm tra", align: "center", cell: (r) => ketQuaKiemTraLabel(r.ketQuaKt) },
  { header: "Mã ct hạch toán", cell: () => NO_DATA_YET },
  { header: "Tên chứng từ hạch toán", cell: () => NO_DATA_YET },
  { header: "Hóa đơn rủi ro", align: "center", cell: () => NO_DATA_YET },
];

interface InvoiceTablePanelProps {
  direction: InvoiceDirection;
  /** Tab này đang được xem — chỉ tự nạp DB khi active để không tốn request cho tab ẩn. */
  active: boolean;
}

type ResultTab = "tong-quat" | "chi-tiet";

/** Nhịp poll tiến độ tải chi tiết: BE chạy nền, FE hỏi trạng thái mỗi khoảng này (ms). */
const POLL_INTERVAL_MS = 1500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Bộ lọc mặc định = tháng hiện tại (từ ngày 1 -> hôm nay). Dùng khi tự nạp lúc mở tab & khi "Bỏ tìm kiếm". */
function defaultMonthFilters(): InvoiceFilterValues {
  return {
    ...currentMonthRange(),
    mstDoiTac: "",
    trangThaiHd: "",
    ketQuaHd: "",
    mauHd: "",
    soSeri: "",
    soHd: "",
  };
}

function buildQuery(filters: InvoiceFilterValues): InvoiceQuery {
  return {
    tuNgay: filters.tuNgay,
    denNgay: filters.denNgay,
    mstDoiTac: filters.mstDoiTac || undefined,
    trangThaiHd: filters.trangThaiHd || undefined,
    ketQuaHd: filters.ketQuaHd || undefined,
    mauHd: filters.mauHd || undefined,
    soSeri: filters.soSeri || undefined,
    soHd: filters.soHd || undefined,
  };
}

/**
 * Nội dung 1 chiều hóa đơn (mua vào HOẶC bán ra): bộ lọc + tabs kết quả + bảng "Tổng quát" +
 * phân trang + nút xuất Excel. Tự quản state (bộ lọc đã áp dụng, trang, lỗi) và gọi query/mutation.
 * Dùng: render 2 lần trong `InvoiceListTabs` (mỗi chiều 1 instance, gắn `active`).
 */
function InvoiceTablePanel({ direction, active }: InvoiceTablePanelProps) {
  const { currentGdtMst, getGdtToken } = useGdtSession();
  const { currentCompanyId } = useAuth();
  const qc = useQueryClient();
  const [resultTab, setResultTab] = useState<ResultTab>("tong-quat");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  // BE tải chi tiết chạy nền; FE poll tiến độ. `detailRunning` để khóa nút trong lúc đang poll.
  const [detailRunning, setDetailRunning] = useState(false);
  // Mỗi lần đổi bộ lọc/công ty tăng 1; vòng poll so khớp để tự dừng (chống chồng chéo lượt cũ).
  const runIdRef = useRef(0);

  // Đổi công ty giữa chừng -> hủy tiến trình đang chạy (id hóa đơn thuộc tenant cũ, sai ở tenant mới).
  // Chỉ bump ref ở đây (không setState trong effect); nhánh hủy trong vòng lặp sẽ reset state.
  useEffect(() => {
    runIdRef.current += 1;
  }, [currentCompanyId]);

  // Bộ lọc mặc định (ổn định) cho form + reset; và bộ lọc "đã áp dụng" quyết định query key.
  const [defaultFilters] = useState(defaultMonthFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);

  // useQuery tự fetch DB khi tab active + khi bộ lọc đã áp dụng đổi.
  const savedQuery = useSavedInvoicesQuery(direction, buildQuery(appliedFilters), active);
  const gdtMutation = useFetchGdtInvoicesMutation(direction);
  // Chi tiết chỉ nạp khi tab "Chi tiết" đang mở (dữ liệu nặng, khỏi tốn request khi chưa xem).
  const savedDetailsQuery = useSavedDetailsQuery(
    direction,
    buildQuery(appliedFilters),
    active && resultTab === "chi-tiet",
  );

  // Bảng LUÔN hiển thị từ DB (nguồn chuẩn). Trong lúc BE tải chi tiết ngầm, cột "T.thái tải" điền
  // dần nhờ vòng poll invalidate savedQuery.
  const rows = useMemo(
    () => (savedQuery.data?.datas ?? []).map((r) => toDisplayRow(r, direction)),
    [savedQuery.data, direction],
  );
  const detailRows = useMemo(
    () => (savedDetailsQuery.data ?? []).flatMap(toDetailRows),
    [savedDetailsQuery.data],
  );
  // Kẹp trang trong khoảng hợp lệ (refetch nền trả ít dòng hơn -> khỏi kẹt ở trang trống).
  const safePage = clampPage(page, rows.length, rowsPerPage);
  const pagedRows = rows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  const dbLoading = savedQuery.isFetching;
  const gdtLoading = gdtMutation.isPending;
  const searched = savedQuery.isFetched;

  /** Áp bộ lọc mới -> dừng vòng poll cũ (nếu có) rồi đổi query key để useQuery đọc lại DB. */
  const applyFilters = (filters: InvoiceFilterValues) => {
    runIdRef.current += 1; // dừng poll cũ để không nhầm tiến độ của khoảng đã đổi
    setPage(0);
    setAppliedFilters(filters);
  };

  /** Nạp lại DANH SÁCH đã lưu (bảng Tổng quát) — dùng trong lúc poll khi có hóa đơn vừa tải xong. */
  const invalidateSavedList = () => {
    qc.invalidateQueries({
      queryKey: invoiceKeys.savedByDirection(currentCompanyId, direction),
    });
  };
  /** Nạp lại cả danh sách + CHI TIẾT (payload nặng `hdhhdvu`) — chỉ dùng khi KẾT THÚC lượt. */
  const invalidateSavedAll = () => {
    invalidateSavedList();
    qc.invalidateQueries({
      queryKey: detailKeys.byDirection(currentCompanyId, direction),
    });
  };

  /**
   * Bắt đầu lượt tải chi tiết CHẠY NỀN ở BE (qua pacer + 429-retry, BỎ QUA HĐ đã có `tt_tai="OK"`)
   * rồi POLL tiến độ tới khi xong. Mỗi lần poll invalidate savedQuery -> cột "T.thái tải" điền dần.
   * Đổi bộ lọc/công ty (bump runIdRef) -> ngừng poll; BE vẫn tự lưu ngầm, lượt mới sẽ thay thế khi cần.
   */
  const pollDetailRun = async (
    gdtToken: string,
    query: InvoiceQuery,
    startRun: number,
  ) => {
    setDetailRunning(true);
    const toastId = toast.loading("Đang tải chi tiết hóa đơn…");
    try {
      let status = await startDetailRun(direction, gdtToken, query);
      let lastDone = -1;
      for (;;) {
        if (runIdRef.current !== startRun) {
          toast.dismiss(toastId);
          return; // đổi bộ lọc/công ty -> ngừng poll (BE vẫn chạy nền)
        }
        toast.update(toastId, {
          render:
            status.total > 0
              ? `Đang tải chi tiết hóa đơn ${status.done}/${status.total}${
                  status.err > 0 ? ` (${status.err} lỗi)` : ""
                }…`
              : "Đang kiểm tra chi tiết…",
        });
        // Chỉ refetch danh sách khi CÓ hóa đơn vừa xong (tránh refetch cả list mỗi 1.5s vô ích).
        if (status.done !== lastDone) {
          invalidateSavedList();
          lastDone = status.done;
        }
        if (!status.active) break;
        await sleep(POLL_INTERVAL_MS);
        status = await getDetailRunStatus(direction);
      }
      toast.update(toastId, {
        render: status.authExpired
          ? `Token Thuế điện tử hết hạn — đã tải ${status.ok}/${status.total}. Đăng nhập lại rồi bấm tải tiếp.`
          : status.total === 0
            ? "Tất cả hóa đơn trong khoảng đã có chi tiết."
            : `Đã tải chi tiết ${status.ok}/${status.total} hóa đơn${
                status.err > 0 ? ` (${status.err} lỗi)` : ""
              }.`,
        type: status.authExpired || status.err > 0 ? "warning" : "success",
        isLoading: false,
        autoClose: 4000,
      });
      invalidateSavedAll(); // cuối lượt mới nạp lại CHI TIẾT (payload nặng), tránh làm trong vòng poll
    } catch (e) {
      toast.update(toastId, {
        render: getErrorMessage(e, "Không tải được chi tiết hóa đơn."),
        type: "error",
        isLoading: false,
        autoClose: 4000,
      });
    } finally {
      setDetailRunning(false);
    }
  };

  /** Lấy token GDT hiện tại; toast cảnh báo + trả undefined nếu chưa đăng nhập Thuế điện tử. */
  const requireGdtToken = (): string | undefined => {
    const gdtToken = currentGdtMst ? getGdtToken(currentGdtMst) : undefined;
    if (!gdtToken || !currentGdtMst) {
      toast.warning('Chưa đăng nhập Thuế điện tử — bấm "Đăng nhập Thuế điện tử" ở trên trước.');
      return undefined;
    }
    return gdtToken;
  };

  /**
   * Cập nhật từ Thuế điện tử: lấy danh sách (BE lưu) rồi khởi động lượt tải chi tiết CHẠY NỀN ở BE
   * và poll tiến độ — cột "T.thái tải" điền dần trên bảng.
   */
  const handleFetchGdt = (filters: InvoiceFilterValues) => {
    if (!filters.tuNgay || !filters.denNgay) {
      toast.warning("Vui lòng chọn đủ Từ ngày / Đến ngày.");
      return;
    }
    const gdtToken = requireGdtToken();
    if (!gdtToken) return;

    setPage(0);
    setAppliedFilters(filters);
    // Chốt mốc lượt hiện tại: nếu đổi công ty giữa lúc lấy list (effect bump runIdRef), bỏ qua onSuccess.
    const startRun = runIdRef.current;
    gdtMutation.mutate(
      { gdtToken, query: buildQuery(filters) },
      {
        onSuccess: (res) => {
          if (runIdRef.current !== startRun) return; // đổi công ty giữa chừng -> không chạy tiếp
          if (res.partial) {
            // Lấy chưa hết (lỗi GDT giữa chừng / chạm trần) — vẫn giữ + xử lý phần đã lấy được.
            toast.warning(
              `Đã lưu ${res.saved ?? 0} hóa đơn nhưng CHƯA lấy hết: ${res.message ?? "lỗi khi gọi Thuế điện tử"}.`,
            );
          } else {
            toast.success(`Đã lưu ${res.saved ?? 0} hóa đơn vào cơ sở dữ liệu.`);
          }
          // Khởi động BE tải chi tiết (bỏ qua HĐ đã có) rồi poll tiến độ.
          void pollDetailRun(gdtToken, buildQuery(filters), startRun);
        },
        onError: (e) =>
          toast.error(getErrorMessage(e, "Không cập nhật được hóa đơn từ Thuế điện tử.")),
      },
    );
  };

  /** Nút "Tải chi tiết" — chạy tải chi tiết ngầm ở BE cho khoảng đang lọc (không lấy list mới). */
  const handleDownloadDetails = () => {
    const gdtToken = requireGdtToken();
    if (!gdtToken) return;
    void pollDetailRun(gdtToken, buildQuery(appliedFilters), runIdRef.current);
  };

  /** Xuất Excel THEO TAB đang mở: Tổng quát -> cột tổng quát; Chi tiết -> cột chi tiết. */
  const handleExport = async () => {
    const range = { tuNgay: appliedFilters.tuNgay, denNgay: appliedFilters.denNgay };
    try {
      if (resultTab === "chi-tiet") await exportDetailXlsx(detailRows, direction, range);
      else await exportOverviewXlsx(rows, direction, range);
      toast.success("Đã xuất file Excel.");
    } catch (e) {
      toast.error(getErrorMessage(e, "Không xuất được file Excel."));
    }
  };

  // Nút xuất bám theo tab đang xem (rỗng thì disable).
  const canExport =
    (resultTab === "chi-tiet" ? detailRows.length : rows.length) > 0 && !detailRunning;

  return (
    <Box sx={{ pt: 2.5 }}>
      <InvoiceFilterPanel
        direction={direction}
        dbLoading={dbLoading}
        gdtLoading={gdtLoading || detailRunning}
        initialValues={defaultFilters}
        onSearch={applyFilters}
        onFetchGdt={handleFetchGdt}
        onReset={() => applyFilters(defaultFilters)}
      />

      {/* Lỗi đọc DB là trạng thái kéo dài -> để inline; các thông báo sự kiện (lưu/tải/lỗi thao
          tác) dùng toast (react-toastify) trong các handler. */}
      {savedQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getErrorMessage(savedQuery.error, "Không đọc được hóa đơn đã lưu.")}
        </Alert>
      )}

      <Stack
        direction="row"
        spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}
      >
        <Tabs
          value={resultTab}
          onChange={(_e, value: ResultTab) => setResultTab(value)}
          sx={{ minHeight: 0 }}
        >
          <Tab label="Tổng quát" value="tong-quat" sx={{ minHeight: 0 }} />
          <Tab label="Chi tiết hoá đơn" value="chi-tiet" sx={{ minHeight: 0 }} />
        </Tabs>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            size="small"
            startIcon={<CloudDownloadRounded fontSize="small" />}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            disabled={rows.length === 0 || detailRunning || gdtLoading}
            onClick={handleDownloadDetails}
          >
            {detailRunning ? "Đang tải chi tiết…" : "Tải chi tiết"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadRounded fontSize="small" />}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            disabled={!canExport}
            onClick={() => void handleExport()}
          >
            Xuất Excel ({resultTab === "chi-tiet" ? "chi tiết" : "tổng quát"})
          </Button>
        </Stack>
      </Stack>

      {resultTab === "chi-tiet" ? (
        <InvoiceDetailPanel
          rows={detailRows}
          loading={savedDetailsQuery.isLoading}
          error={
            savedDetailsQuery.isError
              ? getErrorMessage(savedDetailsQuery.error, "Không đọc được chi tiết đã lưu.")
              : ""
          }
        />
      ) : (
      <>
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
              {COLUMNS.map((col) => (
                <TableCell key={col.header} align={col.align}>
                  {col.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length > 0 ? (
              pagedRows.map((r, i) => {
                const stt = safePage * rowsPerPage + i + 1;
                return (
                  <TableRow key={r.id} hover>
                    {COLUMNS.map((col) => (
                      <TableCell key={col.header} align={col.align}>
                        {col.cell(r, stt)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} sx={{ border: 0, py: 6 }}>
                  <Stack spacing={1} sx={{ alignItems: "center", color: "text.disabled" }}>
                    <InboxRounded fontSize="large" />
                    <Typography variant="body2">
                      {searched ? "Không có hóa đơn nào trong khoảng đã chọn" : "Chưa có dữ liệu"}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {rows.length > 0 && (
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
      )}
      </>
      )}
    </Box>
  );
}

/**
 * Component gốc của khu hóa đơn: 2 tab "Hóa đơn đầu vào/đầu ra". Mount CẢ 2 panel, ẩn tab
 * không active bằng CSS (giữ state riêng từng chiều, không mất dữ liệu khi chuyển qua lại).
 * Dùng: `HomePage`.
 */
export default function InvoiceListTabs() {
  const [tab, setTab] = useState<InvoiceDirection>("purchase");

  /** Đổi tab chiều hóa đơn (purchase/sold). Dùng: `Tabs.onChange` ngay bên dưới. */
  const handleChange = (_e: SyntheticEvent, value: InvoiceDirection) => {
    setTab(value);
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{
          justifyContent: "space-between",
          alignItems: { sm: "center" },
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Tabs value={tab} onChange={handleChange} sx={{ minHeight: 0 }}>
          <Tab label="Hóa đơn đầu vào" value="purchase" />
          <Tab label="Hóa đơn đầu ra" value="sold" />
        </Tabs>

        <Stack direction="row" spacing={1} sx={{ pb: { xs: 1, sm: 0 } }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DescriptionRounded fontSize="small" />}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Lập tờ khai và bảng kê
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadRounded fontSize="small" />}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Xuất file excel tổng hợp và hóa đơn
          </Button>
        </Stack>
      </Stack>

      {/* Mount cả 2 chiều, chỉ ẩn tab không active bằng CSS — giữ state tra cứu riêng cho mỗi
          chiều mà không mất dữ liệu khi chuyển qua lại (remount sẽ reset rows về rỗng). */}
      <Box sx={{ display: tab === "purchase" ? "block" : "none" }}>
        <InvoiceTablePanel direction="purchase" active={tab === "purchase"} />
      </Box>
      <Box sx={{ display: tab === "sold" ? "block" : "none" }}>
        <InvoiceTablePanel direction="sold" active={tab === "sold"} />
      </Box>
    </Box>
  );
}

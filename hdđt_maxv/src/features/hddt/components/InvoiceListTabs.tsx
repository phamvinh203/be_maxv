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
import { trangThaiHdLabel } from "../api/gdt";
import {
  invoiceKeys,
  useFetchGdtInvoicesMutation,
  useSavedInvoicesQuery,
} from "../api/invoiceQueries";
import { detailKeys, useSavedDetailsQuery } from "../api/invoiceDetailQueries";
import { fetchOneInvoiceDetail } from "../api/invoiceDetail";
import { useAuth } from "../../auth/useAuth";
import { toast } from "react-toastify";
import type {
  DisplayRow,
  InvoiceDirection,
  InvoiceFilterValues,
  InvoiceQuery,
  InvoiceRaw,
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
  { header: "Kết quả kiểm tra", align: "center", cell: (r) => r.ketQuaKt },
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

/** Nghỉ giữa mỗi hóa đơn khi tải chi tiết — tránh GDT rate-limit (giống Thread.Sleep bản C#). */
const DETAIL_LOOP_DELAY_MS = 800;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Khóa toàn cục: chỉ 1 tiến trình tải chi tiết chạy 1 lúc trên toàn app. Cần thiết vì CẢ 2 panel
 * (mua vào + bán ra) luôn mount và dùng chung token GDT — chạy song song sẽ gấp đôi request.
 */
let detailRunActive = false;

/** Nếu đang có tiến trình tải chi tiết khác chạy: báo toast + trả true (nơi gọi return luôn). */
function rejectIfBusy(): boolean {
  if (!detailRunActive) return false;
  toast.info("Đang có tiến trình tải chi tiết khác chạy — vui lòng đợi.");
  return true;
}

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

  // Luồng chạy tiến trình từng hóa đơn (progressive): mỗi hóa đơn xử lý xong thì hiện ngay 1 dòng.
  const [liveRows, setLiveRows] = useState<DisplayRow[]>([]);
  const [processing, setProcessing] = useState(false);
  // Mỗi lần chạy tăng 1; vòng lặp so khớp để tự dừng nếu người dùng chạy lượt mới (chống chồng chéo).
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

  const savedRows = useMemo(
    () => (savedQuery.data?.datas ?? []).map((r) => toDisplayRow(r, direction)),
    [savedQuery.data, direction],
  );
  // Đang chạy tiến trình -> hiện dòng chạy dần (liveRows); xong -> hiện từ DB (nguồn chuẩn).
  const rows = processing ? liveRows : savedRows;
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

  /** Áp bộ lọc mới -> hủy tiến trình đang chạy (nếu có) rồi đổi query key để useQuery đọc lại DB. */
  const applyFilters = (filters: InvoiceFilterValues) => {
    runIdRef.current += 1; // dừng loop cũ: bảng thôi hiện liveRows cũ, không tải nhầm HĐ đã lọc bỏ
    setProcessing(false);
    setLiveRows([]);
    setPage(0);
    setAppliedFilters(filters);
  };

  /**
   * Chạy tiến trình từng hóa đơn: lần lượt tải chi tiết + hiện NGAY dòng đó (kèm T.thái tải).
   * Tiến trình hiển thị bằng 1 toast loading tự cập nhật số đếm; xong -> nạp lại từ DB.
   */
  const processInvoicesProgressively = async (
    invoices: InvoiceRaw[],
    gdtToken: string,
  ) => {
    if (invoices.length === 0) return;
    if (rejectIfBusy()) return;
    const myRun = ++runIdRef.current;
    detailRunActive = true;
    setLiveRows([]);
    setPage(0);
    setProcessing(true);
    const toastId = toast.loading(`Đang tải chi tiết hóa đơn 0/${invoices.length}…`);
    // Dọn state + tắt toast khi lượt này bị hủy (đổi bộ lọc / đổi công ty / lượt mới).
    const cancel = () => {
      setProcessing(false);
      setLiveRows([]);
      toast.dismiss(toastId);
    };

    let ok = 0;
    let err = 0;
    try {
      for (let i = 0; i < invoices.length; i++) {
        if (runIdRef.current !== myRun) {
          cancel();
          return; // finally nhả khóa
        }
        const raw = invoices[i];
        toast.update(toastId, {
          render: `Đang tải chi tiết hóa đơn ${i + 1}/${invoices.length}${
            raw.shdon ? ` — HĐ số ${raw.shdon}` : ""
          }…`,
        });

        let ttTai = "error";
        try {
          const res = await fetchOneInvoiceDetail(direction, raw.id, gdtToken);
          ttTai = res.ok ? "OK" : "error";
        } catch {
          ttTai = "error";
        }
        if (ttTai === "OK") ok += 1;
        else err += 1;

        // Hiện ngay dòng vừa xử lý (đã có T.thái tải).
        setLiveRows((prev) => [...prev, { ...toDisplayRow(raw, direction), ttTai }]);

        // Nghỉ giữa các hóa đơn để tránh GDT rate-limit (bỏ nghỉ sau hóa đơn cuối).
        if (i < invoices.length - 1) await sleep(DETAIL_LOOP_DELAY_MS);
      }

      if (runIdRef.current !== myRun) {
        cancel();
        return;
      }
      setProcessing(false);
      toast.update(toastId, {
        render: `Đã tải chi tiết ${ok}/${invoices.length} hóa đơn${
          err > 0 ? ` (${err} lỗi)` : ""
        }.`,
        type: err > 0 ? "warning" : "success",
        isLoading: false,
        autoClose: 4000,
      });
      // Nạp lại nguồn chuẩn từ DB (danh sách + chi tiết) của đúng công ty + chiều này.
      qc.invalidateQueries({
        queryKey: invoiceKeys.savedByDirection(currentCompanyId, direction),
      });
      qc.invalidateQueries({
        queryKey: detailKeys.byDirection(currentCompanyId, direction),
      });
    } finally {
      detailRunActive = false;
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
   * Cập nhật từ Thuế điện tử: lấy danh sách (BE lưu) rồi CHẠY TIẾN TRÌNH từng hóa đơn — mỗi hóa
   * đơn xử lý xong hiện ngay 1 dòng kèm chi tiết, thay vì chờ hết mới hiện.
   */
  const handleFetchGdt = (filters: InvoiceFilterValues) => {
    if (!filters.tuNgay || !filters.denNgay) {
      toast.warning("Vui lòng chọn đủ Từ ngày / Đến ngày.");
      return;
    }
    // Chặn NGAY nếu panel kia đang chạy tiến trình — tránh lưu list xong nhưng bỏ qua tải chi tiết.
    if (rejectIfBusy()) return;
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
          // Chạy tiến trình chi tiết cho đúng danh sách vừa lấy về (kể cả khi partial).
          void processInvoicesProgressively(res.datas ?? [], gdtToken);
        },
        onError: (e) =>
          toast.error(getErrorMessage(e, "Không cập nhật được hóa đơn từ Thuế điện tử.")),
      },
    );
  };

  /** Nút "Tải chi tiết" — chạy tiến trình lại cho danh sách đang có (không cập nhật list mới). */
  const handleDownloadDetails = () => {
    if (rejectIfBusy()) return;
    const gdtToken = requireGdtToken();
    if (!gdtToken) return;
    void processInvoicesProgressively(savedQuery.data?.datas ?? [], gdtToken);
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
    (resultTab === "chi-tiet" ? detailRows.length : rows.length) > 0 && !processing;

  return (
    <Box sx={{ pt: 2.5 }}>
      <InvoiceFilterPanel
        direction={direction}
        dbLoading={dbLoading}
        gdtLoading={gdtLoading || processing}
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
            disabled={rows.length === 0 || processing}
            onClick={handleDownloadDetails}
          >
            {processing ? "Đang tải chi tiết…" : "Tải chi tiết"}
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

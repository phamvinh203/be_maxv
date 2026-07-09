import { useMemo, useState, type ReactNode, type SyntheticEvent } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import InboxRounded from "@mui/icons-material/InboxRounded";
import ConstructionRounded from "@mui/icons-material/ConstructionRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import { useGdtSession } from "../gdtSession/useGdtSession";
import { trangThaiHdLabel } from "../api/gdt";
import {
  useFetchGdtInvoicesMutation,
  useSavedInvoicesQuery,
} from "../api/invoiceQueries";
import type {
  DisplayRow,
  InvoiceDirection,
  InvoiceFilterValues,
  InvoiceQuery,
  InvoiceRaw,
} from "../types";
import InvoiceFilterPanel from "./InvoiceFilterPanel";
import InvoicePagination, { DEFAULT_ROWS_PER_PAGE } from "./InvoicePagination";
import { exportInvoicesToCsv } from "../exportInvoices";
import { currentMonthRange, formatDateVN } from "../dateUtils";
import { getErrorMessage } from "../../../lib/errors";

/** Cột chưa có nguồn dữ liệu (cần API/tính năng riêng, chưa xây) — hiển thị tạm "—". */
const NO_DATA_YET = "—";

/**
 * Ép 1 giá trị bất kỳ (field GDT có kiểu `unknown`) về string an toàn (null/undefined -> "").
 * Dùng: nội bộ file này — `toDisplayRow` (lấy MST/tên bên "mình").
 */
function rowStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/**
 * GDT/DB đều trả cả 2 phía trong mỗi hàng: bên đối tác đã gộp sẵn ở `mstDoiTac`/`tenDoiTac`,
 * còn bên "mình" nằm ở field gốc còn lại (mua vào -> người mua nmmst/nmten; bán ra -> người
 * bán nbmst/nbten). Lấy trực tiếp từ hàng để hiển thị đúng kể cả khi chưa đăng nhập GDT.
 */
function toDisplayRow(r: InvoiceRaw, direction: InvoiceDirection): DisplayRow {
  const isPurchase = direction === "purchase";
  const ownMst = rowStr(isPurchase ? r.nmmst : r.nbmst);
  const ownTen = rowStr(isPurchase ? r.nmten : r.nbten);
  return {
    id: r.id,
    mauHd: r.khmshdon,
    soSeri: r.khhdon,
    soHd: r.shdon,
    ngayLap: r.tdlap,
    sellerMst: isPurchase ? r.mstDoiTac : ownMst,
    sellerTen: isPurchase ? r.tenDoiTac : ownTen,
    sellerDiaChi: isPurchase ? (r.diaChiDoiTac ?? "") : "",
    buyerMst: isPurchase ? ownMst : r.mstDoiTac,
    buyerTen: isPurchase ? ownTen : r.tenDoiTac,
    tienChuaThue: r.tgtcthue,
    tienThue: r.tgtthue,
    cktm: r.ttcktmai,
    phi: r.tgtphi,
    tongTt: r.tgtttbso,
    maNt: r.dvtte ?? "",
    tyGia: r.tgia,
    trangThaiHd: r.tthai,
    ketQuaKt: r.ttxly,
  };
}

/**
 * Định dạng số tiền theo locale vi-VN (1.234.567); không phải số thì trả chuỗi rỗng.
 * Dùng: `COLUMNS` — các cột tiền (tổng tiền, thuế, chiết khấu, phí, tỷ giá...).
 */
function formatMoney(n?: number) {
  if (typeof n !== "number") return "";
  return n.toLocaleString("vi-VN");
}

/** 1 cột bảng "Tổng quát": tiêu đề + căn lề + hàm lấy nội dung ô từ 1 dòng (`stt` = số thứ tự). */
interface InvoiceColumn {
  header: string;
  align?: "right" | "center";
  cell: (row: DisplayRow, stt: number) => ReactNode;
}

const DISABLED_ICON_BTN = (icon: ReactNode) => (
  <IconButton size="small" disabled>
    {icon}
  </IconButton>
);

/** Khai báo 27 cột 1 chỗ — header và body render chung từ đây nên luôn khớp nhau. */
const COLUMNS: InvoiceColumn[] = [
  { header: "STT", cell: (_r, stt) => stt },
  { header: "Ký hiệu mẫu số", cell: (r) => r.mauHd },
  { header: "Ký hiệu hóa đơn", cell: (r) => r.soSeri },
  { header: "Số hóa đơn", cell: (r) => r.soHd },
  { header: "Ngày lập", cell: (r) => formatDateVN(r.ngayLap) },
  { header: "MST người bán/MST người xuất hàng", cell: (r) => r.sellerMst },
  { header: "Tên người bán/Tên người xuất hàng", cell: (r) => r.sellerTen },
  { header: "Địa chỉ người bán", cell: (r) => r.sellerDiaChi || NO_DATA_YET },
  { header: "MST người mua/MST người nhận hàng", cell: (r) => r.buyerMst },
  { header: "CCCD người mua", cell: () => NO_DATA_YET },
  { header: "Tên người mua/Tên người nhận hàng", cell: (r) => r.buyerTen },
  { header: "Tổng tiền chưa thuế", align: "right", cell: (r) => formatMoney(r.tienChuaThue) },
  { header: "Tổng tiền thuế", align: "right", cell: (r) => formatMoney(r.tienThue) },
  { header: "Tổng tiền chiết khấu thương mại", align: "right", cell: (r) => formatMoney(r.cktm) },
  { header: "Tổng tiền phí", align: "right", cell: (r) => formatMoney(r.phi) },
  { header: "Tổng tiền thanh toán", align: "right", cell: (r) => formatMoney(r.tongTt) },
  { header: "Đơn vị tiền tệ", cell: (r) => r.maNt },
  { header: "Tỷ giá", align: "right", cell: (r) => formatMoney(r.tyGia) },
  { header: "Ghi chú: Hóa đơn thay thế, điều chỉnh, bị thay thế, bị điều chỉnh", cell: () => NO_DATA_YET },
  { header: "Trạng thái hóa đơn", align: "center", cell: (r) => trangThaiHdLabel(r.trangThaiHd) },
  { header: "Kết quả kiểm tra hóa đơn", align: "center", cell: (r) => r.ketQuaKt },
  { header: "Website người bán", cell: () => NO_DATA_YET },
  { header: "Url tra cứu hóa đơn gốc", cell: () => NO_DATA_YET },
  { header: "Mã tra cứu hóa đơn gốc", cell: () => NO_DATA_YET },
  { header: "Hóa đơn liên quan", cell: () => NO_DATA_YET },
  { header: "Xem hóa đơn", align: "center", cell: () => DISABLED_ICON_BTN(<VisibilityRounded fontSize="small" />) },
  { header: "Tải file", align: "center", cell: () => DISABLED_ICON_BTN(<DownloadRounded fontSize="small" />) },
];

interface InvoiceTablePanelProps {
  direction: InvoiceDirection;
  /** Tab này đang được xem — chỉ tự nạp DB khi active để không tốn request cho tab ẩn. */
  active: boolean;
}

type ResultTab = "tong-quat" | "chi-tiet";

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
  const [resultTab, setResultTab] = useState<ResultTab>("tong-quat");
  const [error, setError] = useState(""); // lỗi validate / GDT cục bộ
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  // Bộ lọc mặc định (ổn định) cho form + reset; và bộ lọc "đã áp dụng" quyết định query key.
  const [defaultFilters] = useState(defaultMonthFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);

  // useQuery tự fetch DB khi tab active + khi bộ lọc đã áp dụng đổi.
  const savedQuery = useSavedInvoicesQuery(direction, buildQuery(appliedFilters), active);
  const gdtMutation = useFetchGdtInvoicesMutation(direction);

  const rows = useMemo(
    () => (savedQuery.data?.datas ?? []).map((r) => toDisplayRow(r, direction)),
    [savedQuery.data, direction],
  );
  const pagedRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const dbLoading = savedQuery.isFetching;
  const gdtLoading = gdtMutation.isPending;
  const searched = savedQuery.isFetched;
  const displayError =
    error ||
    (savedQuery.isError
      ? getErrorMessage(savedQuery.error, "Không đọc được hóa đơn đã lưu.")
      : "");

  /** Áp bộ lọc mới -> đổi query key -> useQuery tự đọc lại DB. */
  const applyFilters = (filters: InvoiceFilterValues) => {
    setError("");
    setSavedCount(null);
    setPage(0);
    setAppliedFilters(filters);
  };

  /** Tra cứu GDT (BE luôn lưu) -> onSuccess invalidate để bảng tự nạp lại từ DB. */
  const handleFetchGdt = (filters: InvoiceFilterValues) => {
    setError("");
    setSavedCount(null);

    if (!filters.tuNgay || !filters.denNgay) {
      setError("Vui lòng chọn đủ Từ ngày / Đến ngày.");
      return;
    }
    const gdtToken = currentGdtMst ? getGdtToken(currentGdtMst) : undefined;
    if (!gdtToken || !currentGdtMst) {
      setError(
        'Chưa đăng nhập Thuế điện tử — bấm "Đăng nhập Thuế điện tử" ở trên trước khi cập nhật.',
      );
      return;
    }

    // Áp bộ lọc trước để bảng và query khớp nhau, rồi mới tra cứu GDT.
    setPage(0);
    setAppliedFilters(filters);
    gdtMutation.mutate(
      { gdtToken, query: buildQuery(filters) },
      {
        onSuccess: (res) => setSavedCount(res.saved ?? 0),
        onError: (e) =>
          setError(getErrorMessage(e, "Không cập nhật được hóa đơn từ Thuế điện tử.")),
      },
    );
  };

  return (
    <Box sx={{ pt: 2.5 }}>
      <InvoiceFilterPanel
        direction={direction}
        dbLoading={dbLoading}
        gdtLoading={gdtLoading}
        initialValues={defaultFilters}
        onSearch={applyFilters}
        onFetchGdt={handleFetchGdt}
        onReset={() => applyFilters(defaultFilters)}
      />

      {displayError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {displayError}
        </Alert>
      )}
      {savedCount !== null && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Đã lưu {savedCount} hóa đơn vào cơ sở dữ liệu.
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

        <Button
          variant="outlined"
          size="small"
          startIcon={<FileDownloadRounded fontSize="small" />}
          sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          disabled={rows.length === 0}
          onClick={() => exportInvoicesToCsv(rows, direction)}
        >
          Xuất hóa đơn (Excel)
        </Button>
      </Stack>

      {resultTab === "chi-tiet" ? (
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
          <ConstructionRounded fontSize="large" />
          <Typography variant="body2">
            Chi tiết hóa đơn — tính năng đang phát triển.
          </Typography>
        </Box>
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
                const stt = page * rowsPerPage + i + 1;
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
          page={page}
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

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
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
import { useAuth } from "../../auth/useAuth";
import { useGdtSession } from "../gdtSession/useGdtSession";
import {
  getInvoices,
  getSavedInvoices,
  trangThaiHdLabel,
  type InvoiceDirection,
  type InvoiceQuery,
  type InvoiceRaw,
} from "../api/gdt";
import InvoiceFilterPanel, { type InvoiceFilterValues } from "./InvoiceFilterPanel";
import InvoicePagination, { DEFAULT_ROWS_PER_PAGE } from "./InvoicePagination";
import { exportInvoicesToCsv } from "../exportInvoices";

/** Cột chưa có nguồn dữ liệu (cần API/tính năng riêng, chưa xây) — hiển thị tạm "—". */
const NO_DATA_YET = "—";
/** Số cột của bảng "Tổng quát" — dùng cho colSpan của empty-state. */
const COLUMN_COUNT = 27;

/** Dòng hiển thị — chuẩn hóa field GDT + tách rõ bên bán/bên mua theo chiều hóa đơn. */
export interface DisplayRow {
  id: string;
  mauHd: string;
  soSeri: string;
  soHd: string;
  ngayLap: string;
  sellerMst: string;
  sellerTen: string;
  sellerDiaChi: string;
  buyerMst: string;
  buyerTen: string;
  tienChuaThue?: number;
  tienThue?: number;
  cktm?: number;
  phi?: number;
  tongTt: number;
  maNt: string;
  tyGia?: number;
  trangThaiHd: string;
  ketQuaKt: string;
}

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

function formatMoney(n?: number) {
  if (typeof n !== "number") return "";
  return n.toLocaleString("vi-VN");
}

function formatDate(s?: string) {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("vi-VN");
}

interface InvoiceTablePanelProps {
  direction: InvoiceDirection;
  /** Tab này đang được xem — chỉ tự nạp DB khi active để không tốn request cho tab ẩn. */
  active: boolean;
}

type ResultTab = "tong-quat" | "chi-tiet";

/** Bộ lọc mặc định = tháng hiện tại (từ ngày 1 -> hôm nay). Dùng khi tự nạp lúc mở tab & khi "Bỏ tìm kiếm". */
function defaultMonthFilters(): InvoiceFilterValues {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  return {
    tuNgay: fmt(first),
    denNgay: fmt(now),
    mstDoiTac: "",
    trangThaiHd: "",
    ketQuaHd: "",
    mauHd: "",
    soSeri: "",
    soHd: "",
  };
}

function InvoiceTablePanel({ direction, active }: InvoiceTablePanelProps) {
  const { accessToken } = useAuth();
  const { currentGdtMst, getGdtToken } = useGdtSession();
  const [resultTab, setResultTab] = useState<ResultTab>("tong-quat");
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [gdtLoading, setGdtLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  // Lazy init: tính 1 lần, giữ ổn định qua các lần render (không đọc ref trong render).
  const [defaultFilters] = useState(defaultMonthFilters);

  // Cắt dữ liệu theo trang (phân trang phía client trên dữ liệu đã tải).
  const pagedRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const buildQuery = (filters: InvoiceFilterValues): InvoiceQuery => ({
    tuNgay: filters.tuNgay,
    denNgay: filters.denNgay,
    mstDoiTac: filters.mstDoiTac || undefined,
    trangThaiHd: filters.trangThaiHd || undefined,
    ketQuaHd: filters.ketQuaHd || undefined,
    mauHd: filters.mauHd || undefined,
    soSeri: filters.soSeri || undefined,
    soHd: filters.soHd || undefined,
  });

  /** Đọc hóa đơn đã lưu từ DB (không gọi GDT). */
  const loadFromDb = async (filters: InvoiceFilterValues) => {
    if (!accessToken) return;
    if (!filters.tuNgay || !filters.denNgay) {
      setError("Vui lòng chọn đủ Từ ngày / Đến ngày.");
      return;
    }
    setError("");
    setDbLoading(true);
    try {
      const result = await getSavedInvoices(direction, accessToken, buildQuery(filters));
      setRows((result.datas ?? []).map((r) => toDisplayRow(r, direction)));
      setPage(0);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được hóa đơn đã lưu.");
    } finally {
      setDbLoading(false);
    }
  };

  const handleSearch = (filters: InvoiceFilterValues) => {
    setSavedCount(null);
    void loadFromDb(filters);
  };

  /** Tra cứu GDT -> lưu vào DB -> nạp lại từ DB để bảng phản ánh đúng dữ liệu đã lưu. */
  const handleFetchGdt = async (filters: InvoiceFilterValues) => {
    setError("");
    setSavedCount(null);

    if (!filters.tuNgay || !filters.denNgay) {
      setError("Vui lòng chọn đủ Từ ngày / Đến ngày.");
      return;
    }

    const gdtToken = currentGdtMst ? getGdtToken(currentGdtMst) : undefined;
    if (!gdtToken || !currentGdtMst || !accessToken) {
      setError(
        'Chưa đăng nhập Thuế điện tử — bấm "Đăng nhập Thuế điện tử" ở trên trước khi cập nhật.',
      );
      return;
    }

    setGdtLoading(true);
    try {
      const gdtResult = await getInvoices(
        direction,
        { appToken: accessToken, gdtToken },
        buildQuery(filters),
      );
      setSavedCount(gdtResult.saved ?? 0);

      const dbResult = await getSavedInvoices(direction, accessToken, buildQuery(filters));
      setRows((dbResult.datas ?? []).map((r) => toDisplayRow(r, direction)));
      setPage(0);
      setSearched(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không cập nhật được hóa đơn từ Thuế điện tử.",
      );
    } finally {
      setGdtLoading(false);
    }
  };

  const handleReset = () => {
    setSavedCount(null);
    void loadFromDb(defaultFilters);
  };

  // Tự nạp dữ liệu DB (tháng hiện tại) 1 lần, khi tab đã hiển thị và có accessToken —
  // tab ẩn chỉ nạp lần đầu lúc người dùng chuyển sang, tránh 1 request thừa lúc mở trang.
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current && active && accessToken) {
      didInit.current = true;
      void loadFromDb(defaultFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, accessToken]);

  return (
    <Box sx={{ pt: 2.5 }}>
      <InvoiceFilterPanel
        direction={direction}
        dbLoading={dbLoading}
        gdtLoading={gdtLoading}
        initialValues={defaultFilters}
        onSearch={handleSearch}
        onFetchGdt={handleFetchGdt}
        onReset={handleReset}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
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
              <TableCell>STT</TableCell>
              <TableCell>Ký hiệu mẫu số</TableCell>
              <TableCell>Ký hiệu hóa đơn</TableCell>
              <TableCell>Số hóa đơn</TableCell>
              <TableCell>Ngày lập</TableCell>
              <TableCell>MST người bán/MST người xuất hàng</TableCell>
              <TableCell>Tên người bán/Tên người xuất hàng</TableCell>
              <TableCell>Địa chỉ người bán</TableCell>
              <TableCell>MST người mua/MST người nhận hàng</TableCell>
              <TableCell>CCCD người mua</TableCell>
              <TableCell>Tên người mua/Tên người nhận hàng</TableCell>
              <TableCell align="right">Tổng tiền chưa thuế</TableCell>
              <TableCell align="right">Tổng tiền thuế</TableCell>
              <TableCell align="right">Tổng tiền chiết khấu thương mại</TableCell>
              <TableCell align="right">Tổng tiền phí</TableCell>
              <TableCell align="right">Tổng tiền thanh toán</TableCell>
              <TableCell>Đơn vị tiền tệ</TableCell>
              <TableCell align="right">Tỷ giá</TableCell>
              <TableCell>Ghi chú: Hóa đơn thay thế, điều chỉnh, bị thay thế, bị điều chỉnh</TableCell>
              <TableCell align="center">Trạng thái hóa đơn</TableCell>
              <TableCell align="center">Kết quả kiểm tra hóa đơn</TableCell>
              <TableCell>Website người bán</TableCell>
              <TableCell>Url tra cứu hóa đơn gốc</TableCell>
              <TableCell>Mã tra cứu hóa đơn gốc</TableCell>
              <TableCell>Hóa đơn liên quan</TableCell>
              <TableCell align="center">Xem hóa đơn</TableCell>
              <TableCell align="center">Tải file</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length > 0 ? (
              pagedRows.map((r, i) => (
                <TableRow key={r.id} hover>
                  <TableCell>{page * rowsPerPage + i + 1}</TableCell>
                  <TableCell>{r.mauHd}</TableCell>
                  <TableCell>{r.soSeri}</TableCell>
                  <TableCell>{r.soHd}</TableCell>
                  <TableCell>{formatDate(r.ngayLap)}</TableCell>
                  <TableCell>{r.sellerMst}</TableCell>
                  <TableCell>{r.sellerTen}</TableCell>
                  <TableCell>{r.sellerDiaChi || NO_DATA_YET}</TableCell>
                  <TableCell>{r.buyerMst}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell>{r.buyerTen}</TableCell>
                  <TableCell align="right">{formatMoney(r.tienChuaThue)}</TableCell>
                  <TableCell align="right">{formatMoney(r.tienThue)}</TableCell>
                  <TableCell align="right">{formatMoney(r.cktm)}</TableCell>
                  <TableCell align="right">{formatMoney(r.phi)}</TableCell>
                  <TableCell align="right">{formatMoney(r.tongTt)}</TableCell>
                  <TableCell>{r.maNt}</TableCell>
                  <TableCell align="right">{formatMoney(r.tyGia)}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell align="center">{trangThaiHdLabel(r.trangThaiHd)}</TableCell>
                  <TableCell align="center">{r.ketQuaKt}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" disabled>
                      <VisibilityRounded fontSize="small" />
                    </IconButton>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" disabled>
                      <DownloadRounded fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} sx={{ border: 0, py: 6 }}>
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

export default function InvoiceListTabs() {
  const [tab, setTab] = useState<InvoiceDirection>("purchase");

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

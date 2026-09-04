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
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
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
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import CloudDownloadRounded from "@mui/icons-material/CloudDownloadRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import AccountTreeRounded from "@mui/icons-material/AccountTreeRounded";
import { useElementHeight } from "../hooks/useElementHeight";
import { useActiveGdtToken } from "../gdtSession/useActiveGdtToken";
import { useGdtSession } from "../gdtSession/useGdtSession";
import DialogLoginHddt from "../../../components/dialogLoginHddt";
import { invoiceKeys, useSavedInvoicesQuery } from "../api/invoiceQueries";
import { detailKeys, useSavedDetailsQuery } from "../api/invoiceDetailQueries";
import { useDanhMucTraCuuGocQuery } from "../api/traCuuGocQueries";
import { startDetailRun, getDetailRunStatus } from "../api/invoiceDetail";
import {
  getUpdateRunStatus,
  pollUpdateRunToast,
  startUpdateRun,
  type UpdateRunStatus,
} from "../api/updateRun";
import { useAuth } from "../../auth/useAuth";
import { toast } from "react-toastify";
import type {
  DetailRow,
  DisplayRow,
  InvoiceColumnFilterValues,
  InvoiceDirection,
  InvoiceFilterValues,
  InvoiceQuery,
} from "../types";
import { nccHoTroTai } from "../traCuuNcc";
import { taiPdfGoc, taiPdfHoaDon } from "../taiMotHoaDon";
import { toDisplayRow } from "../invoiceRow";
import { buildReplacedByMap, toDetailRows } from "../detailRow";
import { invoiceKey, invoiceSttMap } from "../invoiceFileName";
import {
  columnCellSx,
  headerAlign,
  invoiceRowFill,
  overviewColumns,
  renderCell,
  rowFillSx,
  tongCotSo,
  totalsRow,
} from "../templates";
import InvoiceFilterPanel from "./InvoiceFilterPanel";
import ColumnFilterButton, {
  LIVE_APPLY_MS as PANEL_LIVE_APPLY_MS,
  type SortKind,
} from "../../../components/ColumnFilterButton";
import { applySort, fieldOf, type SortState } from "../columnSort";
import {
  TRANG_THAI_HD_OPTIONS,
  KET_QUA_KIEM_TRA_OPTIONS,
  trangThaiHdLabel,
  ketQuaKiemTraLabel,
} from "../api/gdt";
import { tinhChatLabel } from "../invoiceView";
import {
  containsText,
  inNumRange,
  parseRangeInput,
  formatRangeInput,
  RANGE_INPUT_HINT,
} from "../../../utils/columnFilterText";
import ColumnFilterInput from "../../../components/ColumnFilterInput";
import InvoiceDetailPanel from "./InvoiceDetailPanel";
import InvoiceViewDialog from "./InvoiceViewDialog";
import HoaDonLienQuanDialog from "./HoaDonLienQuanDialog";
import ExportFileDialog from "./ExportFileDialog";
import DialogKeKhai from "../../to_khai/components/DialogKeKhai";
import DownloadOriginalDialog from "./DownloadOriginalDialog";
import InvoicePagination, { DEFAULT_ROWS_PER_PAGE } from "../../../components/InvoicePagination";
import { clampPage } from "../../../utils/pagination";
import { columnDividerSx } from "../../../utils/tableStyles";
import { currentMonthRange } from "../dateUtils";
import { getErrorMessage } from "../../../lib/errors";

interface InvoiceTablePanelProps {
  direction: InvoiceDirection;
  /** Tab này đang được xem — chỉ tự nạp DB khi active để không tốn request cho tab ẩn. */
  active: boolean;
}

/** Khoảng "Từ - Đến" cho 1 cột số — vẫn giữ nguyên state 2 đầu này (dù ô nhập giờ chỉ còn 1 input
 * cú pháp "a-b", xem `parseRangeInput`) để tái dùng nguyên `inNumRange`/`detailRangeFilters`. */
interface ColumnRangeValue {
  from: string;
  to: string;
}
// Tham chiếu ỔN ĐỊNH (không tạo mảng mới mỗi lần) cho nhánh "tab Chi tiết đang ẩn" của
// `detailRows`/`filteredDetailRows`/`sortedDetailRows` — xem chú thích ở `detailRows`.
const EMPTY_DETAIL_ROWS: DetailRow[] = [];

/** Đặc tả sort + ô lọc dòng cố định cho 1 cột — DÙNG CHUNG giữa icon header (chỉ đọc `sortKind`, ẩn
 * hẳn nếu `undefined` cả 2 field) và dòng input cố định dưới header (chỉ đọc `input`) để không phải
 * liệt kê từng `colKey` trong 2 switch riêng (xem `overviewColumnFilterSpec`/`detailColumnFilterSpec`
 * và `renderSharedColumnFilterSpec` cho ~10 cột giống nhau giữa 2 bảng). */
interface ColumnFilterSpec {
  sortKind?: SortKind;
  input?: ReactNode;
}
const NOT_FILTERABLE: ColumnFilterSpec = {};

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

/**
 * Query gửi server CHỈ còn khoảng ngày — thứ DUY NHẤT quyết định query nào chạm DB. Mọi field lọc
 * khác (mauHd, soSeri, soHd, MST/tên/địa chỉ đối tác, trạng thái, kết quả kiểm tra, tiền tệ, trạng
 * thái tải, khoảng tiền/tỷ giá) lọc PHÍA CLIENT qua `matchesOverviewFilters`/
 * `matchesDetailHeaderFilters` — bảng đã tải toàn bộ hóa đơn trong khoảng ngày về một lần, gõ thêm
 * vào các ô lọc đó không cần vòng qua BE nữa.
 */
function buildQuery(filters: InvoiceFilterValues): InvoiceQuery {
  return { tuNgay: filters.tuNgay, denNgay: filters.denNgay };
}

/**
 * Query cho các lượt CHẠY NỀN gọi GDT THẬT (nút "Tải chi tiết" / "Cập nhật từ Thuế điện tử") — khác
 * `buildQuery` ở trên (chỉ khoảng ngày, dùng cho luồng ĐỌC DB). Hai lượt này tốn hạn ngạch cổng thuế
 * (rate-limit) nên PHẢI giữ đúng bộ lọc user đang xem, không được quét cả khoảng ngày mỗi lần bấm —
 * `InvoiceFilterValues` gồm đúng các field server còn lọc được (`buildSavedWhere` bên BE); field lọc
 * riêng theo cột (tên/địa chỉ đối tác, khoảng tiền...) vẫn 100% phía client như trước, không gửi lên.
 */
function buildGdtRunQuery(filters: InvoiceFilterValues): InvoiceQuery {
  return filters;
}

/** Nhãn "Trạng thái tải" DÙNG ĐỂ LỌC — khác `ttTaiLabel` (cho ô hiển thị/Excel, "chưa tải" trả ""
 * vì ô đó không có chữ): thêm nhãn "Chưa tải" để gõ tìm được cả nhóm hóa đơn chưa tải chi tiết. */
function ttTaiSearchLabel(v?: string): string {
  return v === "OK" ? "OK" : v === "error" ? "Lỗi" : "Chưa tải";
}

/**
 * Nhãn gõ vào khớp DUY NHẤT 1 lựa chọn trong `options` -> trả mã (`value`) đó; khớp 0 hoặc ≥2 lựa
 * chọn (gõ chưa đủ rõ, hoặc rỗng) -> trả "". Dùng để GIỚI HẠN LƯỢT GDT NỀN theo đúng 1 mã khi người
 * dùng gõ đủ rõ ràng ở ô "Trạng thái hóa đơn"/"Kết quả kiểm tra" (xem `buildGdtRunQuery`) — KHÔNG
 * dùng cho lọc hiển thị (bảng lọc rộng hơn, qua `containsText` trực tiếp trên nhãn, xem
 * `matchesCommonFilters`).
 */
function resolveUniqueOptionCode(
  needle: string,
  options: readonly { value: string; label: string }[],
): string {
  if (!needle.trim()) return "";
  const hits = options.filter((o) => o.value && containsText(o.label, needle));
  return hits.length === 1 ? hits[0].value : "";
}

const STATUS_LABEL_HINT =
  'Gõ khớp TÊN hiển thị (vd "hủy", "đạt"). Khớp đúng 1 lựa chọn sẽ tự thu hẹp cả lượt "Tải chi tiết"/"Cập nhật từ Thuế điện tử" theo đúng lựa chọn đó.';

/**
 * Cột CHỈ có ở bảng Chi tiết (mã VT, số lượng, đơn giá, tiền dòng hàng...) — không có cột DB tương
 * ứng nên lọc riêng qua `detailTextFilters`/`detailRangeFilters` (xem `detailColumnFilterSpec`).
 * Mọi cột trong 2 danh sách này đều theo ĐÚNG 1 khuôn (đọc `detailXxxFilters[key]`, ghi qua
 * `setDetailText`/`setDetailRange` bằng chính `key`) nên gom vào set thay vì 1 case riêng/cột —
 * cột nào có xử lý khác khuôn chung (kyHieu, ngày, tinhChat có hint riêng) vẫn giữ case riêng.
 */
const DETAIL_ONLY_RANGE_KEYS = new Set([
  "soLuong",
  "gia",
  "tlCktm",
  "tienChuaThue",
  "thueDong",
  "tienSauThueDong",
  "tienChuaThueVnd",
  "thueVnd",
  "tienSauThueVnd",
  "tienCk",
  "tongCk",
  "tongPhi",
  "tongTtVnd",
]);
const DETAIL_ONLY_TEXT_KEYS = new Set([
  "maVt",
  "tenHang",
  "dvt",
  "thueSuat",
  "ghiChu1",
  "hinhThucTt",
  "bienSoXe",
  "websiteNb",
  "msttcgp",
  "urlTraCuu",
  "dliu",
  "timGoogle",
  "mccqt",
]);

/** Dựng đặc tả cho 1 cột số dạng khoảng — DÙNG CHUNG cho mọi cột range (tiền, tỷ giá, số lượng, đơn
 * giá...) ở cả 2 bảng, chỉ khác nguồn `tu`/`den` và nơi ghi lại (`onApply`). */
function rangeFilterSpec(
  tu: string | undefined,
  den: string | undefined,
  onApply: (tu: string | undefined, den: string | undefined) => void,
): ColumnFilterSpec {
  return {
    sortKind: "number",
    input: (
      <ColumnFilterInput
        value={formatRangeInput(tu, den)}
        onApply={(v) => {
          const parsed = parseRangeInput(v);
          onApply(parsed.tu || undefined, parsed.den || undefined);
        }}
        hint={RANGE_INPUT_HINT}
      />
    ),
  };
}

/** Dựng đặc tả cho 1 cột lọc TEXT thường (contains, không phân biệt hoa-thường) — DÙNG CHUNG cho mọi
 * cột text ở cả 2 bảng, chỉ khác nguồn `value`/`onApply`. */
function textFilterSpec(
  value: string,
  onApply: (v: string) => void,
  opts?: { hint?: string; placeholder?: string; sortKind?: SortKind },
): ColumnFilterSpec {
  return {
    sortKind: opts?.sortKind ?? "text",
    input: (
      <ColumnFilterInput value={value} onApply={onApply} hint={opts?.hint} placeholder={opts?.placeholder} />
    ),
  };
}

/** Field lọc chung cho cả `DisplayRow` (bảng Tổng quát) lẫn `DetailRow` (bảng Chi tiết) — 2 kiểu
 * này đặt tên field bên bán/bên mua/tổng tiền/tỷ giá giống hệt nhau nên gộp 1 type dùng chung.
 * `tongTt`/`tyGia` khai `?:` (dù `DisplayRow.tongTt` luôn có) để nhận được cả 2 kiểu row. */
interface CommonFilterRow {
  mauHd: string;
  soHd: string;
  sellerMst: string;
  sellerTen: string;
  sellerDiaChi: string;
  buyerMst: string;
  buyerTen: string;
  buyerDiaChi: string;
  maNt: string;
  trangThaiHd: string;
  ketQuaKt: string;
  tongTt?: number;
  tyGia?: number;
}

/**
 * Phần tiêu chí lọc THEO CỘT giống hệt nhau giữa bảng Tổng quát và bảng Chi tiết (panel "Bộ lọc" +
 * icon header, trừ `soSeri`/`kyHieu` tên field khác nhau nên nhận qua tham số riêng, và `ttTai` +
 * 4 khoảng tiền chỉ bảng Tổng quát mới có). `direction` quyết định field nào là "đối tác" (mua vào:
 * bên bán; bán ra: bên mua), đúng logic `buildSavedWhere` cũ bên BE trước khi chuyển sang client.
 */
function matchesCommonFilters(
  r: CommonFilterRow,
  soSeriValue: string,
  direction: InvoiceDirection,
  f: InvoiceFilterValues,
  c: InvoiceColumnFilterValues,
): boolean {
  const partnerMst = direction === "purchase" ? r.sellerMst : r.buyerMst;
  const partnerTen = direction === "purchase" ? r.sellerTen : r.buyerTen;
  const partnerDiaChi = direction === "purchase" ? r.sellerDiaChi : r.buyerDiaChi;
  return (
    containsText(r.mauHd, f.mauHd) &&
    containsText(soSeriValue, f.soSeri) &&
    containsText(r.soHd, f.soHd) &&
    containsText(partnerMst, f.mstDoiTac) &&
    containsText(partnerTen, c.tenDoiTac ?? "") &&
    containsText(partnerDiaChi, c.diaChiDoiTac ?? "") &&
    containsText(r.maNt, c.maNt ?? "") &&
    // Mã chính xác từ panel "Bộ lọc" (dropdown, cũng là tiêu chí gửi lên BE cho lượt GDT nền).
    (!f.trangThaiHd || r.trangThaiHd === f.trangThaiHd) &&
    (!f.ketQuaHd || r.ketQuaKt === f.ketQuaHd) &&
    // Gõ tự do khớp NHÃN từ ô input dòng cố định — CỘNG THÊM vào tiêu chí mã chính xác ở trên,
    // không thay thế (xem chú thích `InvoiceColumnFilterValues.trangThaiHdText`).
    containsText(trangThaiHdLabel(r.trangThaiHd), c.trangThaiHdText ?? "") &&
    containsText(ketQuaKiemTraLabel(r.ketQuaKt), c.ketQuaHdText ?? "") &&
    inNumRange(r.tongTt, c.tuTongTt, c.denTongTt) &&
    inNumRange(r.tyGia, c.tuTyGia, c.denTyGia)
  );
}

/** Toàn bộ tiêu chí lọc THEO CỘT cho bảng TỔNG QUÁT — chạy client, ngay trên `DisplayRow` đã tải
 * sẵn. Thêm `ttTai` + 4 khoảng tiền so với `matchesCommonFilters` (chỉ bảng này mới có). */
function matchesOverviewFilters(
  r: DisplayRow,
  direction: InvoiceDirection,
  f: InvoiceFilterValues,
  c: InvoiceColumnFilterValues,
): boolean {
  return (
    matchesCommonFilters(r, r.soSeri, direction, f, c) &&
    containsText(ttTaiSearchLabel(r.ttTai), c.ttTai ?? "") &&
    inNumRange(r.tienChuaThue, c.tuTienChuaThue, c.denTienChuaThue) &&
    inNumRange(r.tienThue, c.tuTienThue, c.denTienThue) &&
    inNumRange(r.cktm, c.tuCktm, c.denCktm) &&
    inNumRange(r.phi, c.tuPhi, c.denPhi)
  );
}

/** Tương đương `matchesOverviewFilters` nhưng cho bảng CHI TIẾT (`DetailRow`) — field tên khác đôi
 * chỗ (vd `kyHieu` thay `soSeri`) và KHÔNG có `ttTai` (mọi dòng ở đây chắc chắn đã tải chi tiết). */
function matchesDetailHeaderFilters(
  r: DetailRow,
  direction: InvoiceDirection,
  f: InvoiceFilterValues,
  c: InvoiceColumnFilterValues,
): boolean {
  return matchesCommonFilters(r, r.kyHieu, direction, f, c);
}

/**
 * Nội dung 1 chiều hóa đơn (mua vào HOẶC bán ra): bộ lọc + tabs kết quả + bảng "Tổng quát" +
 * phân trang + nút xuất Excel. Tự quản state (bộ lọc đã áp dụng, trang, lỗi) và gọi query/mutation.
 * Dùng: render 2 lần trong `InvoiceListTabs` (mỗi chiều 1 instance, gắn `active`).
 */
function InvoiceTablePanel({ direction, active }: InvoiceTablePanelProps) {
  const { currentCompanyId } = useAuth();
  // Token GDT của ĐÚNG công ty đang chọn (điểm chọn token duy nhất — chống rò rỉ giữa tenant).
  const { activeMst, token: activeGdtToken } = useActiveGdtToken();
  const { setGdtToken } = useGdtSession();
  // Cột đối tác đổi theo chiều (mua vào: người bán; bán ra: người mua) -> tính theo direction.
  const columns = useMemo(() => overviewColumns(direction), [direction]);
  // Chiều cao thật của hàng tiêu đề (1 hay 2 dòng tùy `webWidth`) -> canh `top` cho hàng tổng dính
  // ngay dưới nó, xem `totalsRow`.
  const [headerRowRef, headerRowHeight] = useElementHeight<HTMLTableRowElement>();
  const qc = useQueryClient();
  const [resultTab, setResultTab] = useState<ResultTab>("tong-quat");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  // Hóa đơn đang mở trong dialog "Xem hóa đơn"; null = không có dialog nào đang mở.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  /** Hóa đơn + loại file đang tải ở cụm cột thao tác; null = không có lượt nào chạy. */
  const [dangTai, setDangTai] = useState<{ id: string; loai: "file" | "goc" } | null>(null);
  /**
   * Hóa đơn đang mở dialog "Hóa đơn liên quan". Tách khỏi `selectedId` vì hai thứ chỉ vào hai hóa
   * đơn khác nhau được: bấm "Xem hóa đơn" TRONG dialog sẽ đổi `selectedId` sang một tờ khác trong
   * chuỗi, mà dialog chuỗi vẫn phải đứng nguyên ở tờ ban đầu.
   */
  const [lienQuanId, setLienQuanId] = useState<string | null>(null);
  // Dialog "Tải hóa đơn gốc" (theo chiều): mở bằng nút "Tải hóa đơn gốc" trong từng tab.
  const [downloadOriginalOpen, setDownloadOriginalOpen] = useState(false);
  /** Mở form đăng nhập Thuế điện tử khi thao tác cần token mà công ty đang chọn chưa đăng nhập. */
  const [loginOpen, setLoginOpen] = useState(false);
  /**
   * Việc đang chờ token: chạy lại NGAY sau khi đăng nhập xong để người dùng khỏi phải bấm nút lần
   * hai. Nhận token qua tham số (không đọc `activeGdtToken`) vì state chưa kịp cập nhật lúc đó.
   */
  const pendingActionRef = useRef<((gdtToken: string) => void) | null>(null);

  // BE tải chi tiết chạy nền; FE poll tiến độ. `detailRunning` để khóa nút trong lúc đang poll.
  const [detailRunning, setDetailRunning] = useState(false);
  // Lượt "Cập nhật từ Thuế điện tử" cũng chạy NỀN ở BE (danh sách + chi tiết trong 1 lượt); FE chỉ
  // poll tiến độ nên đóng tab/F5 không mất lượt. Cờ này để khóa nút trong lúc lượt còn chạy.
  const [updateRunning, setUpdateRunning] = useState(false);
  /** Đang có vòng poll lượt cập nhật — chặn poll trùng khi nối lại lúc lượt còn chạy. */
  const updatePollingRef = useRef(false);
  // Mỗi lần đổi bộ lọc/công ty tăng 1; vòng poll so khớp để tự dừng (chống chồng chéo lượt cũ).
  const runIdRef = useRef(0);

  // Đổi công ty giữa chừng -> hủy tiến trình đang chạy (id hóa đơn thuộc tenant cũ, sai ở tenant mới).
  // Chỉ bump ref ở đây (không setState trong effect); nhánh hủy trong vòng lặp sẽ reset state.
  useEffect(() => {
    runIdRef.current += 1;
  }, [currentCompanyId]);

  // Bộ lọc mặc định (ổn định) cho form + reset. CHỈ tuNgay/denNgay trong đây đi tới server (quyết
  // định query key, xem `buildQuery`) — các field còn lại (mauHd, soSeri, soHd, mstDoiTac, trạng
  // thái, kết quả kiểm tra) lọc PHÍA CLIENT qua `matchesOverviewFilters`/`matchesDetailHeaderFilters`,
  // vì bảng đã tải toàn bộ hóa đơn trong khoảng ngày về một lần rồi (không cần vòng qua BE để lọc
  // tiếp trên dữ liệu đã có sẵn ở màn hình).
  const [defaultFilters] = useState(defaultMonthFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  // Giá trị ĐANG GÕ trên panel "Bộ lọc" (controlled) — tách khỏi `appliedFilters` (chỉ đổi khi bấm
  // Tìm kiếm/icon) để gõ dở không kích lọc lại liên tục. `patchAppliedFilters` ghi cả 2 để icon
  // header và panel luôn khớp nhau.
  const [filterDraft, setFilterDraft] = useState(defaultFilters);
  // Lọc theo icon ở header cột (tên/địa chỉ đối tác, tiền tệ, trạng thái tải, khoảng tiền/tỷ giá) —
  // 100% phía client, tách khỏi `appliedFilters` chỉ để panel "Bộ lọc" và icon cột không tranh nhau
  // ghi đè state của nhau (2 UI, 1 concern khác nhau).
  const [columnFilters, setColumnFilters] = useState<InvoiceColumnFilterValues>({});
  // "Tên hàng hóa, dịch vụ" lọc phía client — field này không có cột riêng trong DB (nằm trong JSON
  // `detail` của hóa đơn đã Tải chi tiết) nên không thể lọc ở server dù muốn.
  const [tenHangFilter, setTenHangFilter] = useState("");
  // Sắp xếp — 100% phía client vì cả 2 bảng đã tải TOÀN BỘ dữ liệu khớp bộ lọc (không phân trang
  // server, xem `getSavedInvoices`/`getSavedInvoiceDetails`) nên sort trên `rows`/`detailRows` luôn
  // đúng trên toàn bộ dữ liệu, không chỉ trang đang xem. Tách riêng theo bảng vì 2 bảng khác cột.
  const [overviewSort, setOverviewSort] = useState<SortState>(null);
  const [detailSort, setDetailSort] = useState<SortState>(null);
  // Lọc CLIENT cho các cột CHỈ có ở bảng Chi tiết (mã VT, số lượng, đơn giá, ghi chú...) — không có
  // cột DB tương ứng ở `vct50view`/`vct60view` (chỉ nằm trong JSON `detail`). Key = `col.key` của
  // bảng Chi tiết.
  const [detailTextFilters, setDetailTextFilters] = useState<Record<string, string>>({});
  const [detailRangeFilters, setDetailRangeFilters] = useState<Record<string, ColumnRangeValue>>(
    {},
  );

  // useQuery tự fetch DB khi tab active + khi khoảng ngày đổi (field lọc còn lại không kích refetch
  // -> `buildQuery` chỉ đọc tuNgay/denNgay, xem chú thích ở đó).
  const savedQuery = useSavedInvoicesQuery(direction, buildQuery(appliedFilters), active);
  // Chi tiết chỉ nạp khi tab "Chi tiết" đang mở (dữ liệu nặng, khỏi tốn request khi chưa xem).
  const savedDetailsQuery = useSavedDetailsQuery(
    direction,
    buildQuery(appliedFilters),
    active && resultTab === "chi-tiet",
  );
  // Danh mục NCC của BE — quyết định URL tra cứu thật (cột "URL tra cứu" của bảng Chi tiết + sheet
  // Excel). Payload nhỏ, không đụng DB, và dùng chung cache với dialog "Tải hóa đơn gốc".
  const danhMucNccQuery = useDanhMucTraCuuGocQuery();

  // Bảng LUÔN hiển thị từ DB (nguồn chuẩn). Trong lúc BE tải chi tiết ngầm, cột "T.thái tải" điền
  // dần nhờ vòng poll invalidate savedQuery.
  /**
   * Bản đồ ngược "HĐ này bị HĐ nào thay thế/điều chỉnh" — dựng từ danh sách `thayThe` do BE trả
   * riêng, KHÔNG phải từ `datas`: hóa đơn thay thế thường lập ở kỳ sau hóa đơn gốc nên nó thường
   * NẰM NGOÀI khoảng đang lọc (xem `readReplacements`). Dùng chung cho cả bảng Tổng quát lẫn bảng
   * Chi tiết để hai bảng ghi giống nhau.
   */
  const replacedBy = useMemo(
    () => buildReplacedByMap(savedQuery.data?.thayThe ?? []),
    [savedQuery.data],
  );
  // Tách lọc khỏi sắp xếp (giống `filteredDetailRows`/`sortedDetailRows` bên dưới) — gộp chung 1
  // memo sẽ khiến MỖI LẦN bấm đổi chiều sắp xếp cũng chạy lại toàn bộ map `toDisplayRow` + lọc qua
  // `matchesOverviewFilters` (hàng nghìn hóa đơn), dù dữ liệu/bộ lọc không đổi gì.
  const filteredRows = useMemo(() => {
    const mapped = (savedQuery.data?.datas ?? []).map((r) => toDisplayRow(r, direction, replacedBy));
    const needle = tenHangFilter.trim().toLowerCase();
    return mapped.filter(
      (r) =>
        (!needle || r.tenHang?.toLowerCase().includes(needle)) &&
        matchesOverviewFilters(r, direction, appliedFilters, columnFilters),
    );
  }, [savedQuery.data, direction, replacedBy, tenHangFilter, appliedFilters, columnFilters]);
  const rows = useMemo(
    () => applySort(filteredRows, overviewSort),
    [filteredRows, overviewSort],
  );
  // Số thứ tự hóa đơn lấy từ BẢNG TỔNG QUÁT (`rows`), tra theo khóa định danh chứ không theo vị trí:
  // hai bảng là hai truy vấn riêng, cùng sắp theo ngày lập nên thứ tự giữa các hóa đơn CÙNG NGÀY
  // không được đảm bảo trùng nhau. Cột "Tên file hóa đơn" đọc số này nên ghép sai là chỉ nhầm file.
  const detailRows = useMemo(() => {
    // Tab "Chi tiết" đang ẩn -> khỏi flatMap hàng chục nghìn dòng hàng (`sortedDetailRows` chỉ dùng
    // khi tab này mở). `savedDetailsQuery.data` vẫn còn trong cache (staleTime 5 phút) sau khi rời
    // tab, và `rows` đổi theo MỌI thao tác sort/lọc ở bảng Tổng quát -> không gate thì tính lại vô ích.
    if (resultTab !== "chi-tiet") return EMPTY_DETAIL_ROWS;
    const sttOf = invoiceSttMap(rows);
    const details = savedDetailsQuery.data ?? [];
    return details.flatMap((d) => {
      const str = (v: unknown): string => (v == null ? "" : String(v));
      const key = invoiceKey(str(d.khmshdon), str(d.khhdon), str(d.shdon), str(d.nbmst));
      return toDetailRows(d, sttOf.get(key) ?? 0, replacedBy, danhMucNccQuery.data);
    });
    // `danhMucNccQuery.data` PHẢI nằm trong deps: danh mục về sau lần render đầu, không tính lại thì
    // cột "URL tra cứu" kẹt ở URL dự phòng của registry FE cho tới khi có thứ khác kích render.
  }, [resultTab, savedDetailsQuery.data, rows, replacedBy, danhMucNccQuery.data]);
  // Lọc CLIENT các cột chỉ có ở bảng Chi tiết rồi sắp xếp — TRƯỚC khi đưa vào `InvoiceDetailPanel`
  // (bảng đó chỉ hiển thị + tự phân trang, không biết gì về filter/sort).
  const filteredDetailRows = useMemo(() => {
    // Chuẩn hóa needle 1 LẦN ở đây (không phải mỗi dòng bên trong `.every`) — cùng lý do đã hoisted
    // `tenHangFilter`'s needle ra ngoài `.filter()` phía trên.
    const textEntries = Object.entries(detailTextFilters)
      .filter(([, v]) => v.trim())
      .map(([key, v]) => [key, v.trim().toLowerCase()] as const);
    const rangeEntries = Object.entries(detailRangeFilters).filter(([, v]) => v.from || v.to);
    return detailRows.filter((r) => {
      if (!matchesDetailHeaderFilters(r, direction, appliedFilters, columnFilters)) return false;
      const rec = r as unknown as Record<string, unknown>;
      const textOk = textEntries.every(([key, needle]) => {
        const val = fieldOf(rec, key);
        if (val == null) return false;
        // "Tính chất" gõ khớp NHÃN hiển thị (vd "khuyến mại"), không phải mã thô "1".."4".
        const hay = key === "tinhChat" ? tinhChatLabel(String(val)) : String(val);
        return hay.toLowerCase().includes(needle);
      });
      if (!textOk) return false;
      return rangeEntries.every(([key, range]) =>
        inNumRange(Number(fieldOf(rec, key)), range.from, range.to),
      );
    });
  }, [detailRows, detailTextFilters, detailRangeFilters, direction, appliedFilters, columnFilters]);
  const sortedDetailRows = useMemo(
    () => applySort(filteredDetailRows, detailSort),
    [filteredDetailRows, detailSort],
  );
  // Cộng trên TOÀN BỘ `rows` nên phải nhớ kết quả: component render lại theo mỗi tick chọn dòng, mỗi
  // lần lật trang và mỗi nhịp poll của lượt "Cập nhật"/"Tải chi tiết", chứ không chỉ khi rows đổi.
  const tong = useMemo(() => tongCotSo(columns, rows), [columns, rows]);
  // Kẹp trang trong khoảng hợp lệ (refetch nền trả ít dòng hơn -> khỏi kẹt ở trang trống).
  const safePage = clampPage(page, rows.length, rowsPerPage);
  const pagedRows = rows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  const dbLoading = savedQuery.isFetching;
  const searched = savedQuery.isFetched;
  // 1 timer/field (KHÔNG dùng chung 1 ref cho cả panel) — nếu chỉ 1 ref, gõ field A rồi đổi sang gõ
  // field B trong lúc A còn đang chờ debounce sẽ HỦY LUÔN commit của A (giá trị A vẫn hiện trên ô
  // nhưng không bao giờ vào `appliedFilters`), mà không có cảnh báo gì cho người dùng.
  const panelLiveTimersRef = useRef<Partial<Record<keyof InvoiceFilterValues, ReturnType<typeof setTimeout>>>>(
    {},
  );

  /** Không truyền `key` = hủy TOÀN BỘ field đang chờ debounce (dùng khi thay cả bộ lọc cùng lúc). */
  const cancelPanelLiveApply = (key?: keyof InvoiceFilterValues) => {
    const timers = panelLiveTimersRef.current;
    if (key) {
      const t = timers[key];
      if (!t) return;
      clearTimeout(t);
      delete timers[key];
      return;
    }
    (Object.values(timers) as Array<ReturnType<typeof setTimeout>>).forEach((t) => clearTimeout(t));
    panelLiveTimersRef.current = {};
  };

  /** Lọc/khoảng đổi -> về trang 1 + bỏ hóa đơn đang chọn (id cũ có thể không còn trong danh sách
   * mới, hoặc vừa bị lọc khỏi danh sách) — dùng chung cho mọi nơi đổi bộ lọc bên dưới. */
  const resetPageAndSelection = () => {
    setPage(0);
    setSelectedId(null);
  };

  /** Áp bộ lọc mới -> dừng vòng poll cũ (nếu có) rồi đổi query key để useQuery đọc lại DB. */
  const applyFilters = (filters: InvoiceFilterValues) => {
    cancelPanelLiveApply();
    runIdRef.current += 1; // dừng poll cũ để không nhầm tiến độ của khoảng đã đổi
    resetPageAndSelection();
    setFilterDraft(filters);
    setAppliedFilters(filters);
  };

  /**
   * Áp 1 lọc theo cột (icon ở header) — lọc PHÍA CLIENT (xem `matchesOverviewFilters`), không đụng
   * server nên KHÔNG cần bump `runIdRef` như `applyFilters` (không có poll/query nào bị lệch vì nó).
   */
  const applyColumnFilter = (patch: Partial<InvoiceColumnFilterValues>) => {
    resetPageAndSelection();
    setColumnFilters((prev) => ({ ...prev, ...patch }));
  };

  /**
   * Gõ tự do ở ô "Trạng thái hóa đơn"/"Kết quả kiểm tra" (dòng input cố định) — HAI việc: (1) ghi
   * text vào `columnFilters` để lọc HIỂN THỊ rộng theo nhãn (`matchesCommonFilters`); (2) nếu text
   * khớp DUY NHẤT 1 mã (`resolveUniqueOptionCode`), thu hẹp THÊM `appliedFilters` (mã chính xác) để
   * lượt "Tải chi tiết"/"Cập nhật từ Thuế điện tử" cũng lọc đúng (xem `buildGdtRunQuery`) — gõ chưa
   * đủ rõ thì lượt nền tạm bỏ qua tiêu chí này (không lọc sai). CỐ Ý không ghi `filterDraft` như
   * `patchAppliedFilters`: dropdown panel "Bộ lọc" không nên nhảy theo mỗi ký tự gõ ở đây.
   */
  const applyStatusLabelFilter = (
    key: "trangThaiHd" | "ketQuaHd",
    textKey: "trangThaiHdText" | "ketQuaHdText",
    options: readonly { value: string; label: string }[],
    text: string,
  ) => {
    resetPageAndSelection();
    setColumnFilters((prev) => ({ ...prev, [textKey]: text || undefined }));
    setAppliedFilters((prev) => ({ ...prev, [key]: resolveUniqueOptionCode(text, options) }));
  };

  /**
   * Sửa 1 field của `appliedFilters` từ icon header (vd cột "Số hóa đơn") — ghi vào ĐÚNG state mà
   * panel "Bộ lọc" đang dùng, để 2 UI luôn khớp nhau thay vì có 2 nơi giữ 2 bản sao của cùng 1 giá
   * trị lọc (panel mở lên vẫn thấy đúng giá trị vừa đặt qua icon, và ngược lại). Cũng lọc phía
   * client (chỉ tuNgay/denNgay còn đi tới server, xem `buildQuery`) nên không bump `runIdRef`. Chỉ
   * hủy timer debounce của ĐÚNG (các) field trong `patch` — field khác đang gõ dở trên panel (vd
   * "Số hóa đơn") không liên quan tới icon cột vừa bấm (vd "Mẫu hóa đơn") thì không được đụng tới.
   */
  const patchAppliedFilters = (patch: Partial<InvoiceFilterValues>) => {
    (Object.keys(patch) as Array<keyof InvoiceFilterValues>).forEach((k) => cancelPanelLiveApply(k));
    resetPageAndSelection();
    setAppliedFilters((prev) => ({ ...prev, ...patch }));
    setFilterDraft((prev) => ({ ...prev, ...patch })); // panel hiện đúng giá trị vừa đặt qua icon
  };

  /**
   * 1 field trên panel "Bộ lọc" vừa đổi. `tuNgay`/`denNgay` CHỈ cập nhật form — đổi khoảng ngày kéo
   * theo gọi server nên phải chờ bấm "Tìm kiếm"/"Cập nhật từ Thuế điện tử" (`applyFilters`), không
   * áp sống được. Các field còn lại lọc phía client (xem `matchesOverviewFilters`) nên áp sống luôn,
   * giống icon ở header: select là lựa chọn RỜI RẠC -> áp ngay; text đang gõ liên tục -> debounce.
   */
  const handlePanelFieldChange = (key: keyof InvoiceFilterValues, value: string) => {
    setFilterDraft((prev) => ({ ...prev, [key]: value }));
    if (key === "tuNgay" || key === "denNgay") return;

    // Chỉ hủy timer của ĐÚNG field này (không đụng field khác đang chờ debounce riêng của nó).
    cancelPanelLiveApply(key);
    const commit = () => {
      delete panelLiveTimersRef.current[key];
      resetPageAndSelection();
      setAppliedFilters((prev) => ({ ...prev, [key]: value }));
      // Panel chọn ĐÚNG 1 trạng thái/kết quả (mã chính xác) -> bỏ luôn text đang gõ dở ở ô lọc dòng
      // cố định của CHÍNH field đó (nếu có): 2 tiêu chí khác nhau AND với nhau (xem
      // `matchesCommonFilters`) nên còn sót lại 1 text KHÔNG khớp nhãn của mã vừa chọn sẽ làm bảng ra
      // 0 kết quả mà không rõ lý do. Panel là lựa chọn CHỦ ĐỘNG/rõ ràng hơn -> panel thắng.
      if (key === "trangThaiHd") setColumnFilters((prev) => ({ ...prev, trangThaiHdText: undefined }));
      if (key === "ketQuaHd") setColumnFilters((prev) => ({ ...prev, ketQuaHdText: undefined }));
    };
    if (key === "trangThaiHd" || key === "ketQuaHd") {
      commit();
    } else {
      panelLiveTimersRef.current[key] = setTimeout(commit, PANEL_LIVE_APPLY_MS);
    }
  };
  useEffect(() => {
    // Dọn mọi hẹn giờ khi đổi tab/công ty giữa lúc đang gõ — tránh setState mồ côi sau khi unmount.
    return () => cancelPanelLiveApply();
  }, [currentCompanyId]);

  // Đổi công ty -> bỏ hóa đơn đang chọn (id thuộc tenant cũ) và đóng dialog. Điều chỉnh state NGAY
  // trong render theo mẫu "lưu giá trị trước" của React (tránh setState trong effect gây render dây
  // chuyền — cùng lý do effect ở trên chỉ bump ref chứ không setState).
  const prevCompanyRef = useRef(currentCompanyId);
  if (prevCompanyRef.current !== currentCompanyId) {
    prevCompanyRef.current = currentCompanyId;
    if (selectedId !== null) setSelectedId(null);
    if (viewOpen) setViewOpen(false);
    if (lienQuanId !== null) setLienQuanId(null);
  }

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

  /**
   * Token GDT của ĐÚNG công ty đang chọn (theo MST), KHÔNG mượn phiên MST khác — tránh fetch data
   * MST này rồi ghi vào DB tenant kia. Chưa đăng nhập GDT cho MST đó -> MỞ LUÔN form đăng nhập
   * (đỡ bắt người dùng tự đi tìm nút "Đăng nhập Thuế điện tử") và hẹn chạy lại `retry` sau khi
   * đăng nhập xong. Chưa chọn công ty có MST thì không có gì để đăng nhập -> chỉ cảnh báo.
   */
  const requireGdtToken = (retry?: (gdtToken: string) => void): string | undefined => {
    if (activeGdtToken) return activeGdtToken;
    if (!activeMst) {
      toast.warning("Chưa chọn công ty có MST để đăng nhập Thuế điện tử.");
      return undefined;
    }
    pendingActionRef.current = retry ?? null;
    setLoginOpen(true);
    return undefined;
  };

  /** Đăng nhập xong: lưu token theo MST rồi chạy tiếp việc đang chờ. */
  const handleLoginSuccess = (gdtToken: string, mst: string) => {
    setGdtToken(mst, gdtToken);
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    // Đăng nhập bằng MST KHÁC công ty đang chọn -> không chạy tiếp (sẽ ghi data sang nhầm tenant).
    if (mst !== activeMst) {
      toast.warning(
        `Đã đăng nhập MST ${mst}, khác công ty đang chọn (${activeMst}) — không chạy tiếp thao tác.`,
      );
      return;
    }
    pending?.(gdtToken);
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
    // Chưa đăng nhập -> mở form đăng nhập, xong sẽ tự chạy lại đúng thao tác này.
    const gdtToken = requireGdtToken((token) => runFetchGdt(filters, token));
    if (!gdtToken) return;
    runFetchGdt(filters, gdtToken);
  };

  /**
   * Bám theo một lượt cập nhật (vừa bấm HOẶC đang chạy sẵn khi quay lại trang): mở toast tiến độ,
   * poll tới khi xong, điền dần bảng. `updatePollingRef` đảm bảo mỗi chiều chỉ có MỘT vòng poll.
   */
  const watchUpdateRun = async (started: UpdateRunStatus, startRun: number) => {
    if (updatePollingRef.current) return;
    updatePollingRef.current = true;
    setUpdateRunning(true);
    // Bảng đọc TOÀN BỘ danh sách (không giới hạn dòng) nên mỗi lần invalidate là một lượt refetch
    // + map lại vài nghìn dòng. Tiến độ đổi liên tục -> invalidate mỗi nhịp 2s sẽ nạp lại bảng hàng
    // nghìn lần cho một lượt dài. Giãn ra 10s: cột "T.thái tải" vẫn điền dần, và `onFinish` luôn
    // nạp lại lần cuối nên không bỏ sót kết quả.
    let lastInvalidateAt = 0;
    try {
      await pollUpdateRunToast(direction, started, {
        // Đổi công ty giữa chừng -> ngừng poll (id hóa đơn thuộc tenant cũ, sai ở tenant mới).
        isStale: () => runIdRef.current !== startRun,
        onProgress: () => {
          if (Date.now() - lastInvalidateAt < 10_000) return;
          lastInvalidateAt = Date.now();
          invalidateSavedList();
        },
        onFinish: () => {
          if (runIdRef.current === startRun) invalidateSavedAll();
        },
      });
    } finally {
      updatePollingRef.current = false;
      setUpdateRunning(false);
    }
  };

  /** Phần chạy thật của "Cập nhật từ Thuế điện tử" — tách ra để dùng lại sau khi đăng nhập xong. */
  const runFetchGdt = (filters: InvoiceFilterValues, gdtToken: string) => {
    setPage(0);
    setAppliedFilters(filters);
    // Chốt mốc lượt hiện tại: đổi công ty giữa chừng (effect bump runIdRef) -> ngừng bám lượt này.
    const startRun = runIdRef.current;
    console.log(
      `[DEBUG-CAPNHAT][FE] Bấm CẬP NHẬT TỪ THUẾ ĐIỆN TỬ ${direction} ${filters.tuNgay}..${filters.denNgay}`,
    );
    // Lượt chạy NỀN ở BE: request này chỉ khởi động (~50ms) rồi FE poll tiến độ. Nhờ vậy khoảng
    // ngày dài không còn bị proxy cắt thành 502, và BE dám kiên nhẫn 10 phút/trang khi GDT chặn.
    void (async () => {
      let started: UpdateRunStatus;
      try {
        started = await startUpdateRun(direction, gdtToken, buildGdtRunQuery(filters));
      } catch (e) {
        console.error("[DEBUG-CAPNHAT][FE] LỖI khởi động lượt cập nhật:", e);
        toast.error(getErrorMessage(e, "Không bắt đầu được lượt cập nhật."));
        return;
      }
      await watchUpdateRun(started, startRun);
    })();
  };

  /**
   * Lượt chạy ở BE nên rời trang / F5 / chuyển tab vẫn còn: hỏi BE xem chiều này có lượt nào đang
   * chạy không rồi NỐI LẠI toast + vòng poll, thay vì tưởng là không có gì đang chạy. Khai báo SAU
   * `watchUpdateRun` (đọc biến trước khi khai báo là lỗi react-hooks/immutability).
   */
  useEffect(() => {
    if (!active || !currentCompanyId) return;
    let dropped = false;
    const startRun = runIdRef.current;
    void (async () => {
      try {
        const status = await getUpdateRunStatus(direction);
        if (dropped || !status.active) return;
        await watchUpdateRun(status, startRun);
      } catch {
        // Không đọc được tiến độ (mạng/chưa chọn công ty) -> bỏ qua, nút vẫn dùng được.
      }
    })();
    return () => {
      dropped = true;
    };
    // Chỉ chạy khi mở tab / đổi công ty; `watchUpdateRun` tự chặn trùng bằng ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, currentCompanyId, direction]);

  /** Nút "Tải chi tiết" — chạy tải chi tiết ngầm ở BE cho khoảng đang lọc (không lấy list mới). */
  const handleDownloadDetails = () => {
    const gdtToken = requireGdtToken((token) =>
      void pollDetailRun(token, buildGdtRunQuery(appliedFilters), runIdRef.current),
    );
    if (!gdtToken) return;
    void pollDetailRun(gdtToken, buildGdtRunQuery(appliedFilters), runIdRef.current);
  };

  /**
   * Tải file của MỘT hóa đơn về thư mục Tải xuống. Cả hai loại đều phải đọc chi tiết đã lưu nên có
   * độ trễ vài giây (PDF còn chờ backend render) — khóa đúng nút vừa bấm và báo bằng toast, đừng để
   * người dùng tưởng bấm hụt rồi bấm lại thành hai lượt tải.
   */
  const handleTaiMotHoaDon = async (loai: "file" | "goc", r: DisplayRow, stt: number) => {
    setDangTai({ id: r.id, loai });
    const laGoc = loai === "goc";
    const toastId = toast.loading(
      laGoc ? `Đang tải hóa đơn gốc ${r.soHd}…` : `Đang tạo PDF hóa đơn ${r.soHd}…`,
    );
    try {
      if (laGoc) {
        await taiPdfGoc({ direction, row: r, stt, danhMucNcc: danhMucNccQuery.data });
      } else {
        await taiPdfHoaDon({ direction, row: r, stt });
      }
      toast.update(toastId, {
        render: `Đã tải hóa đơn ${r.soHd}${laGoc ? " (bản gốc)" : ""}.`,
        type: "success",
        isLoading: false,
        autoClose: 4000,
      });
    } catch (e) {
      toast.update(toastId, {
        render: getErrorMessage(e, "Không tải được file hóa đơn."),
        type: "error",
        isLoading: false,
        autoClose: 8000,
      });
    } finally {
      setDangTai(null);
    }
  };

  /**
   * ~10 cột LỌC/SẮP-XẾP giống hệt nhau giữa 2 bảng (mauHd, số HD, MST/tên/địa chỉ đối tác, tổng
   * thanh toán, tỷ giá, ghi chú/ngày liên quan, trạng thái, kết quả kiểm tra) — gom 1 chỗ để
   * `overviewColumnFilterSpec`/`detailColumnFilterSpec` khỏi tự tay đồng bộ khi 1 trong các field
   * này đổi cách lọc/sort. Trả `undefined` nếu `colKey` không thuộc nhóm này -> nơi gọi tự xử lý
   * tiếp cột riêng của bảng đó (vd `soSeri`/`kyHieu` tên field khác nhau, `ngayLap`/`ngayHd`/
   * `ngayKy`, `maNt` khác nhau ở gợi ý "VND", các cột chỉ có ở bảng Chi tiết...).
   */
  const renderSharedColumnFilterSpec = (colKey: string): ColumnFilterSpec | undefined => {
    switch (colKey) {
      case "mauHd":
        return textFilterSpec(appliedFilters.mauHd, (v) => patchAppliedFilters({ mauHd: v }));
      case "soHd":
        return textFilterSpec(appliedFilters.soHd, (v) => patchAppliedFilters({ soHd: v }), { sortKind: "number" });
      case "sellerMst":
      case "buyerMst":
        return textFilterSpec(appliedFilters.mstDoiTac, (v) => patchAppliedFilters({ mstDoiTac: v }));
      case "sellerTen":
      case "buyerTen":
        return textFilterSpec(columnFilters.tenDoiTac ?? "", (v) => applyColumnFilter({ tenDoiTac: v || undefined }));
      case "tongTt":
        return rangeFilterSpec(columnFilters.tuTongTt, columnFilters.denTongTt, (tu, den) =>
          applyColumnFilter({ tuTongTt: tu, denTongTt: den }),
        );
      case "tyGia":
        return rangeFilterSpec(columnFilters.tuTyGia, columnFilters.denTyGia, (tu, den) =>
          applyColumnFilter({ tuTyGia: tu, denTyGia: den }),
        );
      case "ghiChuLienQuan":
      case "ghiChuDacBiet":
        return { sortKind: "text" };
      case "ngayLienQuan":
        return { sortKind: "date" };
      case "trangThaiHd":
        return textFilterSpec(
          columnFilters.trangThaiHdText ?? "",
          (v) => applyStatusLabelFilter("trangThaiHd", "trangThaiHdText", TRANG_THAI_HD_OPTIONS, v),
          { hint: STATUS_LABEL_HINT },
        );
      case "ketQuaKt":
        return textFilterSpec(
          columnFilters.ketQuaHdText ?? "",
          (v) => applyStatusLabelFilter("ketQuaHd", "ketQuaHdText", KET_QUA_KIEM_TRA_OPTIONS, v),
          { hint: STATUS_LABEL_HINT },
        );
      case "sellerDiaChi":
      case "buyerDiaChi":
        return textFilterSpec(columnFilters.diaChiDoiTac ?? "", (v) => applyColumnFilter({ diaChiDoiTac: v || undefined }));
      case "maNt":
        return textFilterSpec(columnFilters.maNt ?? "", (v) => applyColumnFilter({ maNt: v || undefined }), {
          placeholder: "VND",
        });
      default:
        return undefined;
    }
  };

  /**
   * Đặc tả sort + ô lọc của bảng TỔNG QUÁT theo `colKey` — dùng chung cho CẢ icon header (chỉ đọc
   * `sortKind`) LẪN dòng input cố định dưới header (chỉ đọc `input`), xem `renderHeaderFilter`/
   * `renderFilterInput`. `key` đổi tên theo chiều (sellerTen/buyerTen, sellerDiaChi/buyerDiaChi —
   * xem `dauVao.ts`/`dauRa.ts`) nên khai cả 2 biến thể cùng trỏ về 1 field lọc chung. Các field đã
   * có ở panel "Bộ lọc" (MST, ký hiệu, số HD, trạng thái, kết quả kiểm tra) ghi qua
   * `patchAppliedFilters` — CÙNG state với panel, không phải bản sao riêng — nên panel và ô lọc dòng
   * cố định luôn khớp nhau.
   */
  const overviewColumnFilterSpec = (colKey: string): ColumnFilterSpec => {
    const shared = renderSharedColumnFilterSpec(colKey);
    if (shared) return shared;
    switch (colKey) {
      case "ttTai":
        return textFilterSpec(columnFilters.ttTai ?? "", (v) => applyColumnFilter({ ttTai: v || undefined }), {
          placeholder: "OK / Lỗi / Chưa tải",
        });
      case "soSeri":
        return textFilterSpec(appliedFilters.soSeri, (v) => patchAppliedFilters({ soSeri: v }));
      case "ngayLap":
        return { sortKind: "date" };
      case "tenHang":
        return textFilterSpec(tenHangFilter, setTenHangFilter, {
          hint: "Chỉ tìm trong hóa đơn đã Tải chi tiết (dữ liệu đang hiện trên bảng).",
        });
      case "tienChuaThue":
        return rangeFilterSpec(columnFilters.tuTienChuaThue, columnFilters.denTienChuaThue, (tu, den) =>
          applyColumnFilter({ tuTienChuaThue: tu, denTienChuaThue: den }),
        );
      case "tienThue":
        return rangeFilterSpec(columnFilters.tuTienThue, columnFilters.denTienThue, (tu, den) =>
          applyColumnFilter({ tuTienThue: tu, denTienThue: den }),
        );
      case "cktm":
        return rangeFilterSpec(columnFilters.tuCktm, columnFilters.denCktm, (tu, den) =>
          applyColumnFilter({ tuCktm: tu, denCktm: den }),
        );
      case "phi":
        return rangeFilterSpec(columnFilters.tuPhi, columnFilters.denPhi, (tu, den) =>
          applyColumnFilter({ tuPhi: tu, denPhi: den }),
        );
      default:
        return NOT_FILTERABLE; // stt/lienQuan/xemHoaDon/taiFile/taiGoc/tenFile — nút thao tác
    }
  };

  /** Icon SẮP XẾP cạnh tên cột (mọi cột dữ liệu, trừ cột thao tác/số thứ tự) — lọc đã chuyển hết
   * xuống dòng input cố định (`renderFilterInput`), icon giờ chỉ còn tăng/giảm. */
  const renderHeaderFilter = (colKey: string, header: string): ReactNode => {
    const { sortKind } = overviewColumnFilterSpec(colKey);
    if (!sortKind) return null;
    return (
      <ColumnFilterButton
        label={header}
        sortKind={sortKind}
        sortDir={overviewSort?.key === colKey ? overviewSort.dir : null}
        onSort={(dir) => setOverviewSort(dir ? { key: colKey, dir } : null)}
      />
    );
  };

  /** Ô lọc dòng cố định dưới header của bảng TỔNG QUÁT — `null` nếu cột không lọc được. */
  const renderFilterInput = (colKey: string): ReactNode => overviewColumnFilterSpec(colKey).input ?? null;

  const setDetailText = (key: string, v: string) => setDetailTextFilters((prev) => ({ ...prev, [key]: v }));
  const setDetailRange = (key: string, v: ColumnRangeValue) => setDetailRangeFilters((prev) => ({ ...prev, [key]: v }));

  /**
   * Đặc tả sort + ô lọc của bảng CHI TIẾT theo `colKey` (cùng vai trò `overviewColumnFilterSpec`).
   * Cột trùng ý nghĩa với bảng Tổng quát (MST, ký hiệu, số HD, trạng thái, kết quả kiểm tra, tên/địa
   * chỉ đối tác, tiền tệ, tổng tiền thanh toán, tỷ giá) lọc qua CÙNG state client (`appliedFilters`/
   * `columnFilters`, xem `matchesDetailHeaderFilters`) nên khớp tự nhiên với bảng Tổng quát. Cột CHỈ
   * có ở bảng này (mã VT, số lượng, đơn giá, tiền dòng hàng, ghi chú...) không có cột DB tương ứng
   * -> lọc riêng qua `detailTextFilters`/`detailRangeFilters`.
   */
  const detailColumnFilterSpec = (colKey: string): ColumnFilterSpec => {
    const shared = renderSharedColumnFilterSpec(colKey);
    if (shared) return shared;
    switch (colKey) {
      case "kyHieu":
        return textFilterSpec(appliedFilters.soSeri, (v) => patchAppliedFilters({ soSeri: v }));
      case "ngayHd":
      case "ngayKy":
      case "ngayCqtKy":
        return { sortKind: "date" };
      case "tinhChat":
        return textFilterSpec(detailTextFilters.tinhChat ?? "", (v) => setDetailText("tinhChat", v), {
          hint: 'Gõ khớp TÊN hiển thị (vd "khuyến mại"), không phải mã thô.',
        });
    }
    if (DETAIL_ONLY_RANGE_KEYS.has(colKey)) {
      const v = detailRangeFilters[colKey];
      return rangeFilterSpec(v?.from, v?.to, (tu, den) =>
        setDetailRange(colKey, { from: tu ?? "", to: den ?? "" }),
      );
    }
    if (DETAIL_ONLY_TEXT_KEYS.has(colKey)) {
      return textFilterSpec(detailTextFilters[colKey] ?? "", (v) => setDetailText(colKey, v));
    }
    return NOT_FILTERABLE; // tenFile — computed, không sort/lọc
  };

  /** Icon SẮP XẾP cạnh tên cột của bảng CHI TIẾT — cùng vai trò `renderHeaderFilter`. */
  const renderDetailHeaderFilter = (colKey: string, header: string): ReactNode => {
    const { sortKind } = detailColumnFilterSpec(colKey);
    if (!sortKind) return null;
    return (
      <ColumnFilterButton
        label={header}
        sortKind={sortKind}
        sortDir={detailSort?.key === colKey ? detailSort.dir : null}
        onSort={(dir) => setDetailSort(dir ? { key: colKey, dir } : null)}
      />
    );
  };

  /** Ô lọc dòng cố định dưới header của bảng CHI TIẾT — `null` nếu cột không lọc được. */
  const renderDetailFilterInput = (colKey: string): ReactNode => detailColumnFilterSpec(colKey).input ?? null;

  /**
   * Nội dung ô của CỤM CỘT THAO TÁC — những cột `webOnly` mà template chỉ khai chỗ đứng, còn nút bấm
   * phải nằm ở đây vì cần state của bảng. `undefined` = cột dữ liệu thường, để `renderCell` lo.
   */
  const oThaoTac = (colKey: string, r: DisplayRow, stt: number): ReactNode | undefined => {
    const dangChay = dangTai?.id === r.id;
    // Nút tải nào cũng khóa khi hàng này đang có lượt chạy: hai lượt trên cùng một hóa đơn chỉ tổ
    // tải trùng file, mà lượt sau còn phải xếp hàng sau lượt trước ở backend.
    const nutTai = (
      loai: "file" | "goc",
      nhan: string,
      Icon: typeof FileDownloadRounded,
      chan?: string,
    ) => (
      // `span` bọc ngoài: Tooltip cần một phần tử NHẬN được sự kiện chuột, mà nút disabled thì không.
      <Tooltip title={chan ?? nhan}>
        <span>
          <IconButton
            size="small"
            sx={{ p: 0.25 }}
            disabled={!!chan || dangChay}
            onClick={() => void handleTaiMotHoaDon(loai, r, stt)}
            aria-label={`${nhan} ${r.soHd}`}
          >
            {dangChay && dangTai?.loai === loai ? (
              <CircularProgress size={16} />
            ) : (
              <Icon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>
    );

    switch (colKey) {
      case "lienQuan": {
        // Chỉ hóa đơn thuộc quan hệ thay thế/điều chỉnh (tthai 2-5) mới có chuỗi để xem. Xét theo
        // `tthai` chứ không theo cột ghi chú: ghi chú của nhánh "bị thay thế" dựng từ bản đồ ngược ở
        // FE, tra trượt là trống — trong khi BE vẫn dò ra chuỗi vì nó tra thẳng DB.
        const coChuoi = ["2", "3", "4", "5"].includes(r.trangThaiHd);
        return (
          <Tooltip
            title={coChuoi ? "Xem hóa đơn liên quan" : "Hóa đơn không thay thế/điều chỉnh hóa đơn nào"}
          >
            <span>
              <IconButton
                size="small"
                sx={{ p: 0.25 }}
                disabled={!coChuoi}
                onClick={() => setLienQuanId(r.id)}
                aria-label={`Hóa đơn liên quan của ${r.soHd}`}
              >
                <AccountTreeRounded fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        );
      }
      case "xemHoaDon":
        // `selectedId` là nguồn DUY NHẤT cho biết dialog đang mở hóa đơn nào — set kèm mở dialog
        // trong cùng một lượt bấm, tránh trạng thái lệch (dialog trỏ khác hàng vừa bấm).
        return (
          <Tooltip title="Xem hóa đơn">
            <IconButton
              size="small"
              sx={{ p: 0.25 }}
              onClick={() => {
                setSelectedId(r.id);
                setViewOpen(true);
              }}
              aria-label={`Xem hóa đơn ${r.soHd}`}
            >
              <VisibilityRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      case "taiFile":
        return nutTai("file", "Tải PDF hóa đơn", FileDownloadRounded);
      case "taiGoc":
        // Chặn TRƯỚC khi bấm khi biết chắc là không tải được: NCC phát hành không có bộ tải tự động
        // ở backend thì lượt nào cũng trả 501. Nói lý do trong tooltip thay vì để người dùng bấm rồi
        // ăn một toast lỗi. Chưa có danh mục NCC (query đang bay) -> cũng khóa, vì lúc đó
        // `nccHoTroTai` trả `false` cho tất cả và sẽ báo sai lý do.
        return nutTai(
          "goc",
          "Tải hóa đơn gốc",
          CloudDownloadRounded,
          !danhMucNccQuery.data
            ? "Đang tải danh mục nhà cung cấp…"
            : !r.msttcgp
              ? "Hóa đơn thiếu MST nhà cung cấp phát hành — không tra được bản gốc"
              : !nccHoTroTai(danhMucNccQuery.data, r.msttcgp)
                ? "Nhà cung cấp phát hành chưa hỗ trợ tải tự động"
                : undefined,
        );
      default:
        return undefined;
    }
  };

  return (
    <Box sx={{ pt: 2.5 }}>
      <InvoiceFilterPanel
        direction={direction}
        dbLoading={dbLoading}
        gdtLoading={updateRunning || detailRunning}
        values={filterDraft}
        onFieldChange={handlePanelFieldChange}
        onSearch={applyFilters}
        onFetchGdt={handleFetchGdt}
        onReset={() => {
          setFilterDraft(defaultFilters);
          applyFilters(defaultFilters);
          // "Bỏ tìm kiếm" đưa bảng về đúng trạng thái mặc định -> dọn luôn lọc/sắp xếp theo cột.
          setColumnFilters({});
          setTenHangFilter("");
          setOverviewSort(null);
          setDetailSort(null);
          setDetailTextFilters({});
          setDetailRangeFilters({});
        }}
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
            startIcon={<FileDownloadRounded fontSize="small" />}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            disabled={rows.length === 0 || detailRunning || updateRunning}
            onClick={() => setDownloadOriginalOpen(true)}
          >
            Tải hóa đơn gốc
          </Button>

          <Button
            variant="contained"
            size="small"
            startIcon={<CloudDownloadRounded fontSize="small" />}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            disabled={rows.length === 0 || detailRunning || updateRunning}
            onClick={handleDownloadDetails}
          >
            {detailRunning ? "Đang tải chi tiết…" : "Tải chi tiết"}
          </Button>
        </Stack>
      </Stack>

      {resultTab === "chi-tiet" ? (
        <InvoiceDetailPanel
          rows={sortedDetailRows}
          direction={direction}
          loading={savedDetailsQuery.isLoading}
          error={
            savedDetailsQuery.isError
              ? getErrorMessage(savedDetailsQuery.error, "Không đọc được chi tiết đã lưu.")
              : ""
          }
          renderHeaderExtra={renderDetailHeaderFilter}
          renderHeaderInputExtra={renderDetailFilterInput}
        />
      ) : (
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
                  {renderHeaderFilter(col.key, col.header)}
                </TableCell>
              ))}
            </TableRow>
            {/* Dòng lọc CỐ ĐỊNH dưới header — thay popover cũ, luôn hiện sẵn 1 ô/cột (rỗng nếu cột
                không lọc được, xem `overviewColumnFilterSpec`). `position: "static"` để BỎ hiệu ứng
                dính-khi-cuộn-dọc mà `stickyHeader` áp cho MỌI ô trong `TableHead` — chỉ dòng tiêu đề
                dính, dòng lọc cuộn theo thân bảng (không thì 2 dòng cùng dính ở top:0 đè chữ lên nhau,
                cùng cách `BangHoSo.tsx` bên Dịch vụ công đang làm). */}
            <TableRow sx={{ "& th": { bgcolor: "action.hover", py: 0.25 } }}>
              {columns.map((col) => (
                <TableCell key={col.key} align={col.align} sx={{ position: "static", ...columnCellSx(col) }}>
                  {renderFilterInput(col.key)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length > 0 ? (
              <>
              {/* Hàng tổng đứng NGAY DƯỚI tiêu đề. `rows` (toàn bộ hóa đơn khớp bộ lọc), KHÔNG phải
                  `pagedRows`: đây là tổng của cả bảng nên không đổi khi lật trang — cũng là con số
                  nằm ở sheet Excel. */}
              {totalsRow(columns, tong, headerRowHeight)}
              {pagedRows.map((r, i) => {
                const stt = safePage * rowsPerPage + i + 1;
                return (
                  // Tô cả hàng theo trạng thái/cảnh báo, cùng quy tắc với bảng Chi tiết và Excel.
                  // Hàng ĐANG CHỌN vẫn ưu tiên màu chọn của MUI (`.Mui-selected` đè lên `sx`) — đúng
                  // ý: lúc đó người dùng cần thấy rõ mình đang chỉ vào hóa đơn nào.
                  <TableRow
                    key={r.id}
                    hover
                    selected={selectedId === r.id}
                    sx={rowFillSx(invoiceRowFill(r))}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.key} align={col.align} sx={columnCellSx(col)}>
                        {oThaoTac(col.key, r, stt) ?? renderCell(col, r, stt)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ border: 0, py: 6 }}>
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

      {/* Đứng TRƯỚC InvoiceViewDialog để tờ hóa đơn mở từ trong nó nằm chồng lên trên, và đóng tờ
          hóa đơn thì quay lại đúng chuỗi đang xem thay vì về thẳng bảng. */}
      <HoaDonLienQuanDialog
        open={lienQuanId !== null}
        onClose={() => setLienQuanId(null)}
        direction={direction}
        id={lienQuanId}
        onXemHoaDon={(id) => {
          setSelectedId(id);
          setViewOpen(true);
        }}
      />

      <InvoiceViewDialog
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        direction={direction}
        id={selectedId}
      />

      {/* Bấm "Cập nhật từ Thuế điện tử" / "Tải chi tiết" khi chưa đăng nhập GDT -> mở form này;
          đăng nhập xong dialog tự đóng sau 1s và thao tác đang chờ chạy tiếp. */}
      <DialogLoginHddt
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          pendingActionRef.current = null; // đóng giữa chừng -> bỏ việc đang chờ
        }}
        initialUsername={activeMst}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* "Tải hóa đơn gốc" — tải file PDF gốc theo NCC (hiện MISA). Truyền rows + khoảng đang lọc
          để dựng danh sách NCC và nối chi tiết lấy mã tra cứu. */}
      <DownloadOriginalDialog
        open={downloadOriginalOpen}
        onClose={() => setDownloadOriginalOpen(false)}
        direction={direction}
        rows={rows}
        range={{ tuNgay: appliedFilters.tuNgay, denNgay: appliedFilters.denNgay }}
      />
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
  // Xuất file là thao tác CẢ 2 CHIỀU (mua vào + bán ra) nên đặt ở cấp ngoài này, không theo từng tab.
  const [exportOpen, setExportOpen] = useState(false);
  // Kê khai cũng là thao tác cả 2 chiều: chọn kỳ rồi gán mọi hóa đơn trong kỳ, không theo tab.
  const [keKhaiOpen, setKeKhaiOpen] = useState(false);


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

          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadRounded fontSize="small" />}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            onClick={() => setExportOpen(true)}
          >
            Xuất file excel tổng hợp và hóa đơn
          </Button>

      </Stack>

      {/* Mount cả 2 chiều, chỉ ẩn tab không active bằng CSS — giữ state tra cứu riêng cho mỗi
          chiều mà không mất dữ liệu khi chuyển qua lại (remount sẽ reset rows về rỗng). */}
      <Box sx={{ display: tab === "purchase" ? "block" : "none" }}>
        <InvoiceTablePanel direction="purchase" active={tab === "purchase"} />
      </Box>
      <Box sx={{ display: tab === "sold" ? "block" : "none" }}>
        <InvoiceTablePanel direction="sold" active={tab === "sold"} />
      </Box>

      <ExportFileDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        defaultRange={currentMonthRange()}
      />

      <DialogKeKhai open={keKhaiOpen} onClose={() => setKeKhaiOpen(false)} />
    </Box>
  );
}

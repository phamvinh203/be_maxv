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
// import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import CloudDownloadRounded from "@mui/icons-material/CloudDownloadRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import AccountTreeRounded from "@mui/icons-material/AccountTreeRounded";
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
  DisplayRow,
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
  invoiceRowFill,
  overviewColumns,
  renderCell,
  rowFillSx,
  tongCotSo,
  totalsRow,
} from "../templates";
import InvoiceFilterPanel from "./InvoiceFilterPanel";
import InvoiceDetailPanel from "./InvoiceDetailPanel";
import InvoiceViewDialog from "./InvoiceViewDialog";
import HoaDonLienQuanDialog from "./HoaDonLienQuanDialog";
import ExportFileDialog from "./ExportFileDialog";
import DownloadOriginalDialog from "./DownloadOriginalDialog";
import InvoicePagination, { DEFAULT_ROWS_PER_PAGE } from "./InvoicePagination";
import { clampPage } from "../pagination";
import { currentMonthRange } from "../dateUtils";
import { getErrorMessage } from "../../../lib/errors";

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
  const { currentCompanyId } = useAuth();
  // Token GDT của ĐÚNG công ty đang chọn (điểm chọn token duy nhất — chống rò rỉ giữa tenant).
  const { activeMst, token: activeGdtToken } = useActiveGdtToken();
  const { setGdtToken } = useGdtSession();
  // Cột đối tác đổi theo chiều (mua vào: người bán; bán ra: người mua) -> tính theo direction.
  const columns = useMemo(() => overviewColumns(direction), [direction]);
  const qc = useQueryClient();
  const [resultTab, setResultTab] = useState<ResultTab>("tong-quat");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  // Hóa đơn đang chọn (checkbox cột "Chọn") để bật nút "Xem hóa đơn"; null = chưa chọn.
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

  // Bộ lọc mặc định (ổn định) cho form + reset; và bộ lọc "đã áp dụng" quyết định query key.
  const [defaultFilters] = useState(defaultMonthFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);

  // useQuery tự fetch DB khi tab active + khi bộ lọc đã áp dụng đổi.
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
  const rows = useMemo(
    () => (savedQuery.data?.datas ?? []).map((r) => toDisplayRow(r, direction, replacedBy)),
    [savedQuery.data, direction, replacedBy],
  );
  // Số thứ tự hóa đơn lấy từ BẢNG TỔNG QUÁT (`rows`), tra theo khóa định danh chứ không theo vị trí:
  // hai bảng là hai truy vấn riêng, cùng sắp theo ngày lập nên thứ tự giữa các hóa đơn CÙNG NGÀY
  // không được đảm bảo trùng nhau. Cột "Tên file hóa đơn" đọc số này nên ghép sai là chỉ nhầm file.
  const detailRows = useMemo(() => {
    const sttOf = invoiceSttMap(rows);
    const details = savedDetailsQuery.data ?? [];
    return details.flatMap((d) => {
      const str = (v: unknown): string => (v == null ? "" : String(v));
      const key = invoiceKey(str(d.khmshdon), str(d.khhdon), str(d.shdon), str(d.nbmst));
      return toDetailRows(d, sttOf.get(key) ?? 0, replacedBy, danhMucNccQuery.data);
    });
    // `danhMucNccQuery.data` PHẢI nằm trong deps: danh mục về sau lần render đầu, không tính lại thì
    // cột "URL tra cứu" kẹt ở URL dự phòng của registry FE cho tới khi có thứ khác kích render.
  }, [savedDetailsQuery.data, rows, replacedBy, danhMucNccQuery.data]);
  // Cộng trên TOÀN BỘ `rows` nên phải nhớ kết quả: component render lại theo mỗi tick chọn dòng, mỗi
  // lần lật trang và mỗi nhịp poll của lượt "Cập nhật"/"Tải chi tiết", chứ không chỉ khi rows đổi.
  const tong = useMemo(() => tongCotSo(columns, rows), [columns, rows]);
  // Kẹp trang trong khoảng hợp lệ (refetch nền trả ít dòng hơn -> khỏi kẹt ở trang trống).
  const safePage = clampPage(page, rows.length, rowsPerPage);
  const pagedRows = rows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  const dbLoading = savedQuery.isFetching;
  const searched = savedQuery.isFetched;

  /** Áp bộ lọc mới -> dừng vòng poll cũ (nếu có) rồi đổi query key để useQuery đọc lại DB. */
  const applyFilters = (filters: InvoiceFilterValues) => {
    runIdRef.current += 1; // dừng poll cũ để không nhầm tiến độ của khoảng đã đổi
    setPage(0);
    setSelectedId(null); // khoảng/bộ lọc đổi -> bỏ chọn (id cũ có thể không còn trong danh sách)
    setAppliedFilters(filters);
  };

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
        started = await startUpdateRun(direction, gdtToken, buildQuery(filters));
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
      void pollDetailRun(token, buildQuery(appliedFilters), runIdRef.current),
    );
    if (!gdtToken) return;
    void pollDetailRun(gdtToken, buildQuery(appliedFilters), runIdRef.current);
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
      case "chon":
        return (
          <Checkbox
            size="small"
            sx={{ p: 0 }}
            checked={selectedId === r.id}
            onChange={(e) => setSelectedId(e.target.checked ? r.id : null)}
            slotProps={{ input: { "aria-label": `Chọn hóa đơn ${r.soHd}` } }}
          />
        );
      case "xemHoaDon":
        // Mở thẳng hóa đơn của ĐÚNG hàng này, khỏi phải cuộn ngược lên nút ở đầu bảng. Vẫn đi qua
        // `selectedId` (nguồn duy nhất của dialog) nên checkbox cùng hàng tự tích theo — bảng không
        // bao giờ chỉ vào hai hóa đơn khác nhau.
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
          {resultTab === "tong-quat" && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<VisibilityRounded fontSize="small" />}
              sx={{ textTransform: "none", whiteSpace: "nowrap" }}
              disabled={!selectedId}
              onClick={() => setViewOpen(true)}
            >
              Xem hóa đơn
            </Button>
            
          )}

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
          rows={detailRows}
          direction={direction}
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
              {columns.map((col) => (
                <TableCell key={col.key} align={col.align}>
                  {col.header}
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
              {totalsRow(columns, tong)}
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
                      <TableCell key={col.key} align={col.align}>
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
          {/* <Button
            variant="outlined"
            size="small"
            startIcon={<DescriptionRounded fontSize="small" />}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Lập tờ khai và bảng kê
          </Button> */}
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
    </Box>
  );
}

import { useEffect, useRef, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContentText from "@mui/material/DialogContentText";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import TextField from "@mui/material/TextField";
import Collapse from "@mui/material/Collapse";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import { toast } from "react-toastify";
import { TOAST_KET_QUA_NEN } from "../../../lib/toastChayNen";
import { useQueryClient } from "@tanstack/react-query";
import { currentMonthRange, formatDateVN, formatDateTimeVN } from "../dateUtils";
import { syncLogDescription, syncLogReason } from "../syncLogText";
import { getErrorMessage } from "../../../lib/errors";
import { type SyncDirection, type SyncKind, type SyncLog, type SyncRunStatus } from "../types";
import {
  useCancelSyncRunMutation,
  useClearSyncMutation,
  useDeleteSyncHistoryMutation,
  useInvalidateTenantInvoiceData,
  useStartSyncRunMutation,
  useSyncHistoryQuery,
} from "../api/syncQueries";
import { getSyncRunStatus } from "../api/sync";
import { invoiceKeys } from "../api/invoiceQueries";
import { pollDetailRunToast } from "../api/invoiceDetail";
import { useAuth } from "../../auth/useAuth";
import { useActiveGdtToken } from "../gdtSession/useActiveGdtToken";
import { useGdtSession } from "../gdtSession/useGdtSession";
import DialogLoginHddt from "../../../components/dialogLoginHddt";

interface Props {
  open: boolean;
  onClose: () => void;
}

const HISTORY_COLUMNS = [
  "STT",
  "Từ ngày",
  "Đến ngày",
  "Số lượng đồng bộ",
  "Trạng thái",
  "Diễn giải",
  "Ngày đồng bộ",
  "Hành động",
];

/**
 * [DEBUG-SYNC] Đồng hồ đo từ lúc bấm nút. Đặt ở module scope vì `Date.now()` gọi trong thân
 * component bị rule `react-hooks/purity` chặn (nó không phân biệt được render với event handler).
 */
function startTimer(): () => string {
  const t0 = Date.now();
  return () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
}

/** Nhịp poll tiến độ lượt đồng bộ nền — 2s đủ mượt mà không dội BE (lượt kéo hàng chục phút). */
const SYNC_POLL_INTERVAL_MS = 2000;
/** Số nhịp poll LỖI LIÊN TIẾP tối đa trước khi bỏ theo dõi (~10s) — xem lý do ở chỗ bắt lỗi. */
const MAX_POLL_FAILS = 5;
const sleepMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Dialog "Đồng bộ hóa đơn" — chọn chiều/loại hóa đơn + khoảng ngày, gọi BE đồng bộ từ GDT,
 * hiển thị lịch sử đồng bộ thật và cho xóa dữ liệu đã đồng bộ.
 */
export default function SyncInvoiceDialog({ open, onClose }: Props) {
  const { currentCompanyId } = useAuth();
  // Token GDT của ĐÚNG công ty đang chọn (điểm chọn token duy nhất — chống rò rỉ giữa tenant).
  const { activeMst, token: activeGdtToken } = useActiveGdtToken();
  const { setGdtToken } = useGdtSession();
  const qc = useQueryClient();
  // Ref theo dõi công ty hiện tại LIVE (cập nhật cả khi dialog đóng vì component vẫn mounted) — để
  // vòng poll tải chi tiết chạy nền biết người dùng đã đổi công ty giữa chừng thì dừng, tránh lẫn tenant.
  const companyIdRef = useRef(currentCompanyId);
  useEffect(() => {
    companyIdRef.current = currentCompanyId;
  }, [currentCompanyId]);

  const [direction, setDirection] = useState<SyncDirection>("all");
  const [invoiceKind, setInvoiceKind] = useState<SyncKind>("all");
  const [range, setRange] = useState(currentMonthRange);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  /** Dòng lịch sử đang chờ xác nhận xóa (null = không mở dialog xác nhận xóa dòng). */
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<SyncLog | null>(null);
  const [error, setError] = useState("");

  /** Tiến độ lượt đồng bộ nền ở BE (null = chưa có lượt nào trong phiên xem này). */
  const [runStatus, setRunStatus] = useState<SyncRunStatus | null>(null);
  /** Đang có vòng poll chạy — chặn poll trùng khi mở lại dialog lúc lượt còn chạy. */
  const pollingRef = useRef(false);
  /** Form đăng nhập Thuế điện tử, mở khi bấm Đồng bộ mà công ty đang chọn chưa có token GDT. */
  const [loginOpen, setLoginOpen] = useState(false);

  const historyQuery = useSyncHistoryQuery(open);
  const history = historyQuery.data ?? [];
  const loadingHistory = historyQuery.isFetching;
  const startMutation = useStartSyncRunMutation();
  const cancelMutation = useCancelSyncRunMutation();
  const invalidateInvoiceData = useInvalidateTenantInvoiceData();
  const clearMutation = useClearSyncMutation();
  const deleteHistoryMutation = useDeleteSyncHistoryMutation();

  // "Đang đồng bộ" = đang gọi POST /sync/run HOẶC BE báo còn lượt chạy (poll). Không dùng
  // `startMutation.isPending` một mình: request đó trả về sau ~50ms, lượt mới chỉ vừa bắt đầu.
  const syncing = startMutation.isPending || runStatus?.active === true;
  const clearing = clearMutation.isPending;
  const busy = syncing || clearing;
  const displayError =
    error ||
    (historyQuery.isError
      ? getErrorMessage(historyQuery.error, "Không đọc được lịch sử đồng bộ.")
      : "");

  // Mở dialog -> reset lỗi (lịch sử tự nạp qua useQuery vì enabled = open).
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
  }, [open]);

  const handleSync = () => {
    setError("");
    if (!range.tuNgay || !range.denNgay) {
      setError("Vui lòng chọn đủ Từ ngày / Đến ngày.");
      return;
    }
    // Chưa đăng nhập GDT -> mở luôn form đăng nhập rồi tự đồng bộ tiếp, thay vì bắt người dùng
    // đóng dialog đi tìm nút "Đăng nhập Thuế điện tử" rồi quay lại.
    if (!activeGdtToken) {
      if (!activeMst) {
        setError("Chưa chọn công ty có MST để đăng nhập Thuế điện tử.");
        return;
      }
      setLoginOpen(true);
      return;
    }
    runSyncWithToken(activeGdtToken);
  };

  /** Phần chạy thật của nút Đồng bộ — tách ra để chạy lại được ngay sau khi đăng nhập xong. */
  const runSyncWithToken = (gdtToken: string) => {
    // [DEBUG-SYNC] Mốc bấm nút — đối chiếu với log BE.
    const since = startTimer();
    console.log(
      `[DEBUG-SYNC][FE] Bấm ĐỒNG BỘ ${range.tuNgay}..${range.denNgay} direction=${direction} loai=${invoiceKind}`,
    );
    startMutation.mutate(
      {
        gdtToken,
        body: { tuNgay: range.tuNgay, denNgay: range.denNgay, direction, loai: invoiceKind },
      },
      {
        onSuccess: (started) => {
          // [DEBUG-SYNC] BE trả tiến độ NGAY (~50ms) rồi chạy nền; từ đây FE poll status.
          console.log(`[DEBUG-SYNC][FE] Lượt nền đã khởi động sau ${since()}:`, started);
          setRunStatus(started);
          void pollRun(gdtToken);
        },
        onError: (e) => {
          // [DEBUG-SYNC] Lỗi khi KHỞI ĐỘNG lượt (không còn là lỗi của cả lượt đồng bộ dài).
          console.error(
            `[DEBUG-SYNC][FE] LỖI khởi động sau ${since()} — status=${(e as { status?: number }).status ?? "(không có – fetch đứt)"}`,
            e,
          );
          setError(getErrorMessage(e, "Không bắt đầu được lượt đồng bộ."));
        },
      },
    );
  };

  /**
   * Poll tiến độ lượt đồng bộ nền tới khi BE báo xong, rồi xử lý kết quả y như luồng cũ (toast tóm
   * tắt theo chiều + tải chi tiết). Chạy nền: đóng dialog vẫn tiếp tục, và mở lại dialog thì
   * `resume effect` bên dưới nối lại vòng poll vì trạng thái thật nằm ở BE.
   */
  const pollRun = async (gdtToken: string) => {
    if (pollingRef.current) return; // đã có vòng poll (vd mở lại dialog) -> không chạy 2 vòng
    pollingRef.current = true;
    const startedCompanyId = currentCompanyId;
    const isStale = () => companyIdRef.current !== startedCompanyId;

    let status: SyncRunStatus;
    let fails = 0;
    try {
      for (;;) {
        await sleepMs(SYNC_POLL_INTERVAL_MS);
        // Đổi công ty giữa chừng: endpoint status trả tiến độ của công ty MỚI -> ngừng poll.
        if (isStale()) return;
        try {
          status = await getSyncRunStatus();
          fails = 0;
        } catch (e) {
          // Lỗi mạng chập 1 nhịp poll -> thử lại nhịp sau, KHÔNG bỏ lượt (lượt vẫn chạy ở BE).
          // Nhưng lỗi LIÊN TIẾP quá ngưỡng = mất kết nối thật: phải thoát, nếu không vòng lặp quay
          // mãi, `syncing` kẹt true và nút Đồng bộ khóa vĩnh viễn cho tới khi F5.
          fails += 1;
          console.warn(`[DEBUG-SYNC][FE] Poll lỗi nhịp ${fails}/${MAX_POLL_FAILS}:`, e);
          if (fails >= MAX_POLL_FAILS) {
            setError("Mất kết nối khi theo dõi tiến độ — lượt vẫn chạy ở máy chủ, mở lại cửa sổ này để xem tiếp.");
            return;
          }
          continue;
        }
        setRunStatus(status);
        if (!status.active) break;
      }
    } finally {
      pollingRef.current = false;
    }

    console.log(`[DEBUG-SYNC][FE] Lượt nền KẾT THÚC:`, status);
    if (status.error) setError(status.error);
    // Lượt xong -> nạp lại lịch sử + bảng hóa đơn + thống kê.
    if (!isStale()) invalidateInvoiceData();
    await handleRunFinished(status.results, gdtToken, isStale);
  };

  /** Toast tóm tắt theo từng chiều + tải chi tiết — tách ra để cả poll lẫn resume dùng chung. */
  const handleRunFinished = async (
    results: SyncRunStatus["results"],
    gdtToken: string,
    isStale: () => boolean,
  ) => {
    // Toast tóm tắt DANH SÁCH theo từng chiều (all -> 2 toast: mua vào + bán ra). Góc DƯỚI PHẢI để
    // đứng cùng chỗ với toast tiến độ của chính lượt này — xem `TOAST_KET_QUA_NEN`.
    results.forEach((res) => {
      const dirLabel =
        res.direction === "purchase" ? "Mua vào" : res.direction === "sold" ? "Bán ra" : "Tất cả";
      if (res.trang_thai !== "done") {
        toast.warning(
          `${dirLabel} — chưa hoàn thành: ${syncLogReason(res.dien_giai) || "lỗi khi đồng bộ"}. Đã bổ sung ${res.boSung}, đã có sẵn ${res.daCo}.`,
          TOAST_KET_QUA_NEN,
        );
      } else if (res.boSung === 0) {
        toast.success(
          `${dirLabel} — đầy đủ, không thiếu hóa đơn (đã có sẵn ${res.daCo}).`,
          TOAST_KET_QUA_NEN,
        );
      } else {
        toast.success(
          `${dirLabel} — đã bổ sung ${res.boSung} hóa đơn thiếu (đã có sẵn ${res.daCo}).`,
          TOAST_KET_QUA_NEN,
        );
      }
    });

    // Sau khi soát/bổ sung DANH SÁCH: tải CHI TIẾT giống nút "Cập nhật từ Thuế điện tử" — FE lái
    // startDetailRun + poll getDetailRunStatus theo TỪNG CHIỀU đã đồng bộ xong, toast tiến độ
    // cập nhật dần. Tuần tự mua vào -> bán ra (nhẹ với GDT). Chỉ tải cho chiều danh sách đã
    // "done" (chiều lỗi giữa chừng thì danh sách chưa đủ). Chạy nền, không chặn UI; toast tự
    // chạy tiếp kể cả khi đóng dialog.
    // Nối lại tiến độ sau khi F5 thì không còn token GDT trong tay -> bỏ qua phần chi tiết, người
    // dùng bấm "Tải chi tiết" ở bảng hóa đơn sau (danh sách đã lưu xong nên không mất gì).
    if (!gdtToken) {
      toast.info(
        'Đã đồng bộ xong danh sách. Bấm "Tải chi tiết" ở bảng hóa đơn để tải chi tiết.',
        TOAST_KET_QUA_NEN,
      );
      return;
    }

    for (const res of results) {
      if (res.trang_thai !== "done") continue;
      if (res.direction !== "purchase" && res.direction !== "sold") continue;
      if (isStale()) break; // đổi công ty giữa chừng -> ngừng, khỏi tải nhầm tenant
      const authExpired = await pollDetailRunToast(res.direction, gdtToken, range, {
        isStale,
        // Chỉ invalidate khi vẫn đúng công ty đã đồng bộ (đổi công ty thì id đã cũ).
        onFinish: () => {
          if (!isStale()) qc.invalidateQueries({ queryKey: invoiceKeys.byCompany(currentCompanyId) });
        },
      });
      if (authExpired) break; // token hết hạn -> chiều còn lại cũng lỗi y hệt, dừng
    }
  };

  /**
   * Mở dialog -> hỏi BE xem có lượt đồng bộ nào đang chạy không rồi NỐI LẠI vòng poll. Nhờ trạng
   * thái nằm ở BE (không phải trong component), đóng dialog / F5 / mở ở tab khác vẫn thấy đúng
   * tiến độ thay vì tưởng là không có gì đang chạy. Khai báo SAU `pollRun` (đọc biến trước khi
   * khai báo là lỗi react-hooks/immutability).
   */
  useEffect(() => {
    if (!open) return;
    let dropped = false;
    void (async () => {
      try {
        const status = await getSyncRunStatus();
        if (dropped || !status.active) return;
        setRunStatus(status);
        void pollRun(activeGdtToken ?? "");
      } catch {
        // Không đọc được tiến độ (mạng/chưa chọn công ty) -> bỏ qua, nút Đồng bộ vẫn dùng được.
      }
    })();
    return () => {
      dropped = true;
    };
    // Chỉ chạy khi mở dialog; `pollRun` tự chặn trùng bằng `pollingRef`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Đăng nhập GDT xong (từ form mở bởi nút Đồng bộ): lưu token theo MST rồi đồng bộ luôn. */
  const handleLoginSuccess = (gdtToken: string, mst: string) => {
    setGdtToken(mst, gdtToken);
    // Đăng nhập MST khác công ty đang chọn -> KHÔNG đồng bộ (sẽ ghi data sang nhầm tenant).
    if (mst !== activeMst) {
      setError(
        `Đã đăng nhập MST ${mst}, khác công ty đang chọn (${activeMst}) — chưa đồng bộ. ` +
          "Hãy đăng nhập đúng MST của công ty đang chọn.",
      );
      return;
    }
    runSyncWithToken(gdtToken);
  };

  /** Bấm Dừng: BE thoát ở ranh giới trang gần nhất; vòng poll sẽ tự thấy `active=false`. */
  const handleCancelRun = () => {
    cancelMutation.mutate(undefined, {
      onSuccess: (status) => {
        setRunStatus(status);
        toast.info("Đã gửi yêu cầu dừng — đang kết thúc trang hiện tại…", TOAST_KET_QUA_NEN);
      },
      onError: (e) => setError(getErrorMessage(e, "Không dừng được lượt đồng bộ.")),
    });
  };

  const handleClear = () => {
    setError("");
    clearMutation.mutate(undefined, {
      onSuccess: () => setConfirmClear(false),
      onError: (e) => setError(getErrorMessage(e, "Không xóa được dữ liệu đã đồng bộ.")),
    });
  };

  /** Xóa 1 dòng lịch sử đồng bộ (chỉ bản ghi log, không đụng hóa đơn đã lưu). */
  const handleDeleteRow = () => {
    if (!confirmDeleteRow) return;
    setError("");
    deleteHistoryMutation.mutate(confirmDeleteRow.id, {
      onSuccess: () => {
        setConfirmDeleteRow(null);
        toast.success("Đã xóa dòng lịch sử đồng bộ.");
      },
      onError: (e) => setError(getErrorMessage(e, "Không xóa được dòng lịch sử đồng bộ.")),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={clearing ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2 } } }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: 3, pt: 2.5, pb: 2 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Đồng bộ hóa đơn
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Chọn khoảng thời gian cần đồng bộ từ hệ thống hóa đơn điện tử
          </Typography>
        </Box>
        <IconButton
          aria-label="Đóng"
          onClick={onClose}
          size="small"
          disabled={clearing}
          sx={{ mt: -0.5 }}
        >
          <CloseRounded fontSize="small" />
        </IconButton>
      </Box>
      <Divider />

      <DialogContent sx={{ pt: 2.5 }}>
        {/* Chọn chiều đồng bộ */}
        <FormControl sx={{ mb: 2 }}>
          <FormLabel sx={{ fontWeight: 700, color: "text.primary", mb: 0.5 }}>
            Chọn đồng bộ hóa đơn mua vào / bán ra
          </FormLabel>
          <RadioGroup
            row
            value={direction}
            onChange={(e) => setDirection(e.target.value as SyncDirection)}
          >
            <FormControlLabel value="all" control={<Radio size="small" />} label="Đồng bộ tất cả" />
            <FormControlLabel
              value="sold"
              control={<Radio size="small" />}
              label="Chỉ đồng bộ hóa đơn bán ra"
            />
            <FormControlLabel
              value="purchase"
              control={<Radio size="small" />}
              label="Chỉ đồng bộ hóa đơn mua vào"
            />
          </RadioGroup>
        </FormControl>

        {/* Chọn loại hóa đơn */}
        <FormControl sx={{ mb: 2 }}>
          <FormLabel sx={{ fontWeight: 700, color: "text.primary", mb: 0.5 }}>
            Chọn đồng bộ loại hóa đơn
          </FormLabel>
          <RadioGroup
            row
            value={invoiceKind}
            onChange={(e) => setInvoiceKind(e.target.value as SyncKind)}
          >
            <FormControlLabel value="all" control={<Radio size="small" />} label="Đồng bộ tất cả" />
            <FormControlLabel
              value="except_ctt"
              control={<Radio size="small" />}
              label="Đồng bộ tất cả trừ hóa đơn máy tính tiền"
            />
            <FormControlLabel
              value="only_ctt"
              control={<Radio size="small" />}
              label="Chỉ đồng bộ hóa đơn máy tính tiền"
            />
          </RadioGroup>
        </FormControl>

        {/* Khoảng ngày */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            mb: 2.5,
          }}
        >
          <TextField
            label="Từ ngày"
            type="date"
            value={range.tuNgay}
            onChange={(e) => setRange((r) => ({ ...r, tuNgay: e.target.value }))}
            size="small"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Đến ngày"
            type="date"
            value={range.denNgay}
            onChange={(e) => setRange((r) => ({ ...r, denNgay: e.target.value }))}
            size="small"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>

        {/* Thêm lịch đồng bộ (gập/mở) */}
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 2.5 }}>
          <Box
            role="button"
            onClick={() => setScheduleOpen((v) => !v)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 1.25,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <Typography sx={{ fontWeight: 600 }}>Thêm lịch đồng bộ</Typography>
            <ExpandMoreRounded
              sx={{
                transition: "transform 0.15s",
                transform: scheduleOpen ? "rotate(180deg)" : "none",
                color: "text.secondary",
              }}
            />
          </Box>
          <Collapse in={scheduleOpen}>
            <Divider />
            <Box sx={{ px: 2, py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Lịch đồng bộ tự động đang được phát triển. Bạn sẽ có thể đặt tần suất (hằng ngày /
                hằng tuần) để hệ thống tự đồng bộ hóa đơn theo lịch.
              </Typography>
            </Box>
          </Collapse>
        </Box>

        {displayError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {displayError}
          </Alert>
        )}

        {/* Tiến độ lượt đồng bộ nền: lượt chạy ở BE nên đóng/mở lại dialog vẫn hiện đúng. GDT không
            cho biết tổng số trang -> thanh chạy vô định + số liệu cộng dồn, không phải %. */}
        {runStatus?.active && (
          <Alert
            severity="info"
            icon={<CircularProgress size={18} />}
            sx={{ mb: 2 }}
            action={
              <Button
                size="small"
                color="inherit"
                sx={{ textTransform: "none" }}
                disabled={cancelMutation.isPending || runStatus.cancelled}
                onClick={handleCancelRun}
              >
                {runStatus.cancelled ? "Đang dừng…" : "Dừng"}
              </Button>
            }
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Đang đồng bộ: {runStatus.phase || "chuẩn bị…"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Trang {runStatus.page} — đã lấy {runStatus.rows} hóa đơn, bổ sung {runStatus.boSung},
              đã có sẵn {runStatus.daCo}. Có thể đóng cửa sổ này, lượt vẫn chạy tiếp.
            </Typography>
            <LinearProgress sx={{ mt: 1 }} />
          </Alert>
        )}

        {/* Lịch sử đồng bộ hóa đơn */}
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>Lịch sử đồng bộ hóa đơn</Typography>
          {loadingHistory && <CircularProgress size={16} />}
        </Stack>
        <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
          <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
                {HISTORY_COLUMNS.map((col) => (
                  <TableCell key={col} align={col === "Hành động" ? "center" : "left"}>
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {history.length > 0 ? (
                history.map((row, i) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{formatDateVN(row.tu_ngay)}</TableCell>
                    <TableCell>{formatDateVN(row.den_ngay)}</TableCell>
                    <TableCell>
                      {row.da_luu}/{row.tong}
                    </TableCell>
                    <TableCell>
                      {row.trang_thai === "done" ? (
                        <Chip size="small" color="success" variant="outlined" label="Hoàn thành" />
                      ) : (
                        <Tooltip title={syncLogReason(row.dien_giai)}>
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label="Chưa hoàn thành"
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>{syncLogDescription(row)}</TableCell>
                    <TableCell>{formatDateTimeVN(row.created_at)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Xóa dòng lịch sử này">
                        {/* span để Tooltip vẫn hiện khi nút bị disabled */}
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            aria-label="Xóa dòng lịch sử đồng bộ"
                            disabled={
                              busy ||
                              (deleteHistoryMutation.isPending &&
                                deleteHistoryMutation.variables === row.id)
                            }
                            onClick={() => setConfirmDeleteRow(row)}
                          >
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={HISTORY_COLUMNS.length}
                    sx={{ border: 0, py: 5, textAlign: "center", color: "text.disabled" }}
                  >
                    {loadingHistory ? "Đang tải…" : "Chưa có lịch sử đồng bộ hóa đơn."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ justifyContent: "space-between", px: 3, py: 2 }}>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineRounded />}
          sx={{ textTransform: "none" }}
          disabled={busy || history.length === 0}
          onClick={() => setConfirmClear(true)}
        >
          Xóa dữ liệu đã đồng bộ
        </Button>
        <Stack direction="row" spacing={1.5}>
          {/* Đóng được cả khi đang đồng bộ: lượt chạy ở BE, mở lại dialog sẽ nối lại tiến độ. */}
          <Button
            color="inherit"
            onClick={onClose}
            disabled={clearing}
            sx={{ textTransform: "none" }}
          >
            {syncing ? "Đóng" : "Hủy"}
          </Button>
          <Button
            variant="contained"
            startIcon={syncing ? <CircularProgress size={18} color="inherit" /> : <SyncRounded />}
            sx={{ textTransform: "none" }}
            disabled={busy}
            onClick={handleSync}
          >
            Đồng bộ
          </Button>
        </Stack>
      </DialogActions>

      {/* Xác nhận xóa dữ liệu đã đồng bộ */}
      <Dialog open={confirmClear} onClose={() => !clearing && setConfirmClear(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Xóa dữ liệu đã đồng bộ</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Toàn bộ hóa đơn đã lưu trong cơ sở dữ liệu (bao gồm cả hóa đơn tra cứu thủ công ở
            trang Hóa đơn điện tử, không chỉ hóa đơn đã đồng bộ) và toàn bộ lịch sử đồng bộ sẽ bị
            xóa. Hành động này không ảnh hưởng đến dữ liệu gốc trên hệ thống Thuế điện tử.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmClear(false)} disabled={clearing}>
            Hủy
          </Button>
          <Button variant="contained" color="error" onClick={handleClear} disabled={clearing}>
            {clearing ? <CircularProgress size={20} color="inherit" /> : "Xóa"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Xác nhận xóa 1 dòng lịch sử đồng bộ */}
      <Dialog
        open={!!confirmDeleteRow}
        onClose={() => !deleteHistoryMutation.isPending && setConfirmDeleteRow(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Xóa dòng lịch sử đồng bộ</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmDeleteRow && (
              <>
                Xóa dòng lịch sử đồng bộ từ {formatDateVN(confirmDeleteRow.tu_ngay)} đến{" "}
                {formatDateVN(confirmDeleteRow.den_ngay)} khỏi danh sách?{" "}
              </>
            )}
            Chỉ xóa bản ghi lịch sử này, KHÔNG ảnh hưởng đến hóa đơn đã lưu trong cơ sở dữ liệu.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDeleteRow(null)} disabled={deleteHistoryMutation.isPending}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteRow}
            disabled={deleteHistoryMutation.isPending}
          >
            {deleteHistoryMutation.isPending ? <CircularProgress size={20} color="inherit" /> : "Xóa"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bấm Đồng bộ khi chưa đăng nhập Thuế điện tử -> mở form này; đăng nhập xong dialog tự đóng
          sau 1s rồi lượt đồng bộ chạy luôn. */}
      <DialogLoginHddt
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        initialUsername={activeMst}
        onLoginSuccess={handleLoginSuccess}
      />
    </Dialog>
  );
}

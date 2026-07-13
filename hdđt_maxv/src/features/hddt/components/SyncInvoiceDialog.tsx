import { useEffect, useState } from "react";
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
import { useGdtSession } from "../gdtSession/useGdtSession";
import { currentMonthRange, formatDateVN, formatDateTimeVN } from "../dateUtils";
import { getErrorMessage } from "../../../lib/errors";
import { type SyncDirection, type SyncKind, type SyncLog } from "../types";
import {
  useClearSyncMutation,
  useStartSyncMutation,
  useSyncHistoryQuery,
} from "../api/syncQueries";

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
];

const DIRECTION_LABEL: Record<SyncDirection, string> = {
  all: "tất cả",
  purchase: "mua vào",
  sold: "bán ra",
};

/**
 * Dialog "Đồng bộ hóa đơn" — chọn chiều/loại hóa đơn + khoảng ngày, gọi BE đồng bộ từ GDT,
 * hiển thị lịch sử đồng bộ thật và cho xóa dữ liệu đã đồng bộ.
 */
export default function SyncInvoiceDialog({ open, onClose }: Props) {
  const { currentGdtMst, getGdtToken } = useGdtSession();

  const [direction, setDirection] = useState<SyncDirection>("all");
  const [invoiceKind, setInvoiceKind] = useState<SyncKind>("all");
  const [range, setRange] = useState(currentMonthRange);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SyncLog | null>(null);

  const historyQuery = useSyncHistoryQuery(open);
  const history = historyQuery.data ?? [];
  const loadingHistory = historyQuery.isFetching;
  const startMutation = useStartSyncMutation();
  const clearMutation = useClearSyncMutation();

  const syncing = startMutation.isPending;
  const clearing = clearMutation.isPending;
  const busy = syncing || clearing;
  const displayError =
    error ||
    (historyQuery.isError
      ? getErrorMessage(historyQuery.error, "Không đọc được lịch sử đồng bộ.")
      : "");

  // Mở dialog -> reset thông báo (lịch sử tự nạp qua useQuery vì enabled = open).
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setResult(null);
  }, [open]);

  const handleSync = () => {
    setError("");
    setResult(null);
    if (!range.tuNgay || !range.denNgay) {
      setError("Vui lòng chọn đủ Từ ngày / Đến ngày.");
      return;
    }
    const gdtToken = currentGdtMst ? getGdtToken(currentGdtMst) : undefined;
    if (!gdtToken || !currentGdtMst) {
      setError('Chưa đăng nhập Thuế điện tử — bấm "Đăng nhập Thuế điện tử" trước khi đồng bộ.');
      return;
    }
    startMutation.mutate(
      {
        gdtToken,
        body: { tuNgay: range.tuNgay, denNgay: range.denNgay, direction, loai: invoiceKind },
      },
      {
        onSuccess: (log) => setResult(log),
        onError: (e) => setError(getErrorMessage(e, "Không đồng bộ được hóa đơn.")),
      },
    );
  };

  const handleClear = () => {
    setError("");
    clearMutation.mutate(undefined, {
      onSuccess: () => {
        setConfirmClear(false);
        setResult(null);
      },
      onError: (e) => setError(getErrorMessage(e, "Không xóa được dữ liệu đã đồng bộ.")),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="md"
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
        <IconButton aria-label="Đóng" onClick={onClose} size="small" disabled={busy} sx={{ mt: -0.5 }}>
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
        {result && (
          <Alert severity={result.trang_thai === "done" ? "success" : "warning"} sx={{ mb: 2 }}>
            Đã đồng bộ {result.da_luu}/{Math.max(result.tong, result.da_luu)} hóa đơn{" "}
            {result.trang_thai === "done"
              ? "— hoàn thành."
              : `— chưa hoàn thành: ${result.dien_giai ?? ""}`}
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
                  <TableCell key={col}>{col}</TableCell>
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
                        <Tooltip title={row.dien_giai ?? ""}>
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label="Chưa hoàn thành"
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>Đồng bộ hóa đơn {DIRECTION_LABEL[row.direction]}</TableCell>
                    <TableCell>{formatDateTimeVN(row.created_at)}</TableCell>
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
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: "none" }}>
            Hủy
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
    </Dialog>
  );
}

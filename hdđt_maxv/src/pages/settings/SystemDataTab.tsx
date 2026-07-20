import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import SyncRounded from "@mui/icons-material/SyncRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import ReceiptRounded from "@mui/icons-material/ReceiptRounded";
import StorageRounded from "@mui/icons-material/StorageRounded";
import AccessTimeRounded from "@mui/icons-material/AccessTimeRounded";
import { useAuth } from "../../features/auth/useAuth";
import { getAllSavedInvoices } from "../../features/hddt/api/gdt";
import { useSystemStatsQuery } from "../../features/hddt/api/statsQueries";
import { useClearSyncMutation } from "../../features/hddt/api/syncQueries";
import { toDisplayRow } from "../../features/hddt/invoiceRow";
import { exportSavedBackupCsv } from "../../features/hddt/exportInvoices";
import { formatDateTimeVN } from "../../features/hddt/dateUtils";
import { getErrorMessage } from "../../lib/errors";
import SyncInvoiceDialog from "../../features/hddt/components/SyncInvoiceDialog";

interface AutomationToggle {
  key: string;
  label: string;
  description: string;
}

/** Các toggle chưa nối logic thật — cần scheduler/cron riêng (xem tab "Lịch tự động đồng bộ"). */
const PLACEHOLDER_TOGGLES: AutomationToggle[] = [
  {
    key: "autoDownload",
    label: "Tự động tải hóa đơn về khi có hóa đơn mới",
    description: "Kiểm tra và tải hóa đơn mua vào/bán ra mới phát sinh trên GDT theo định kỳ.",
  },
  {
    key: "autoSyncOnOpen",
    label: "Tự động đồng bộ khi mở ứng dụng",
    description: "Chạy 1 lượt đồng bộ hóa đơn ngay khi đăng nhập vào ứng dụng.",
  },
];

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, flex: 1, minWidth: 180, display: "flex", gap: 1.5, alignItems: "center" }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "primary.main",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary" noWrap>
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 700 }} noWrap>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

/** Ước lượng dung lượng theo số dòng (mỗi hóa đơn lưu kèm raw JSON ~2KB). */
function estimateSize(rows: number): string {
  const mb = (rows * 2) / 1024;
  return mb < 0.1 ? `${rows * 2} KB` : `${mb.toFixed(1)} MB`;
}

export default function SystemDataTab() {
  const { isAuthenticated } = useAuth();
  const statsQuery = useSystemStatsQuery();
  const stats = statsQuery.data;
  const clearMutation = useClearSyncMutation();

  const [toggles, setToggles] = useState<Record<string, boolean>>({
    autoDownload: false,
    autoSyncOnOpen: false,
  });
  const [retention, setRetention] = useState("12");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const toggle = (key: string) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const totalRows = (stats?.purchase ?? 0) + (stats?.sold ?? 0);
  /** Trả "…" khi đang tải thống kê, ngược lại trả giá trị đã tính. */
  const cell = (value: string) => (statsQuery.isLoading ? "…" : value);
  // Lỗi đọc thống kê phải hiện rõ, đừng để cả 4 ô im lặng về 0 như tenant rỗng.
  const statsError = statsQuery.isError
    ? getErrorMessage(statsQuery.error, "Không đọc được thống kê dữ liệu.")
    : "";

  const handleClear = () => {
    setError("");
    clearMutation.mutate(undefined, {
      onSuccess: () => setConfirmClearOpen(false),
      onError: (e) => setError(getErrorMessage(e, "Không xóa được dữ liệu đã lưu.")),
    });
  };

  /** Sao lưu toàn bộ hóa đơn đã lưu (cả 2 chiều) ra 1 file CSV. */
  const handleExport = async () => {
    if (!isAuthenticated) return;
    setError("");
    setNotice("");
    setExporting(true);
    try {
      const [p, s] = await getAllSavedInvoices();
      const purchase = (p.datas ?? []).map((r) => toDisplayRow(r, "purchase"));
      const sold = (s.datas ?? []).map((r) => toDisplayRow(r, "sold"));
      if (purchase.length === 0 && sold.length === 0) {
        setError("Chưa có hóa đơn nào để sao lưu.");
        return;
      }
      exportSavedBackupCsv(purchase, sold);
      // Backup lấy theo khoảng ngày nên vẫn có thể ít hơn tổng trong DB (HĐ ngoài khoảng) —
      // đối chiếu với thống kê để người dùng biết bản sao lưu chưa phủ hết dữ liệu.
      if (purchase.length < (stats?.purchase ?? 0) || sold.length < (stats?.sold ?? 0)) {
        setNotice(
          `Bản sao lưu chưa gồm toàn bộ hóa đơn trong hệ thống ` +
            `(${purchase.length}/${stats?.purchase ?? 0} mua vào, ${sold.length}/${stats?.sold ?? 0} bán ra) — ` +
            `hãy mở rộng khoảng ngày rồi sao lưu lại.`,
        );
      }
    } catch (e) {
      setError(getErrorMessage(e, "Không sao lưu được dữ liệu."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Dữ liệu hệ thống
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Thống kê và quản lý dữ liệu hóa đơn đã lưu. (Các toggle "Tự động hóa" và "Thời gian lưu
        trữ" bên dưới chỉ minh họa — cần scheduler/cron riêng, chưa nối chức năng.)
      </Typography>

      {statsError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => statsQuery.refetch()}>
              Thử lại
            </Button>
          }
        >
          {statsError}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}

      {/* Tự động hóa */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Tự động hóa
        </Typography>
        <Stack divider={<Divider />} spacing={1.5}>
          {PLACEHOLDER_TOGGLES.map((item) => (
            <Stack
              key={item.key}
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{item.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
              </Box>
              <Switch checked={toggles[item.key]} onChange={() => toggle(item.key)} />
            </Stack>
          ))}
        </Stack>
      </Paper>

      {/* Dung lượng dữ liệu đã lưu */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Dung lượng dữ liệu đã lưu
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <StatCard icon={<ReceiptRounded />} label="Hóa đơn mua vào đã lưu" value={cell(`${stats?.purchase ?? 0} hóa đơn`)} />
        <StatCard icon={<ReceiptLongRounded />} label="Hóa đơn bán ra đã lưu" value={cell(`${stats?.sold ?? 0} hóa đơn`)} />
        <StatCard icon={<StorageRounded />} label="Dung lượng ước tính" value={cell(estimateSize(totalRows))} />
        <StatCard
          icon={<AccessTimeRounded />}
          label="Lần đồng bộ gần nhất"
          value={cell(stats?.lastSyncAt ? formatDateTimeVN(stats.lastSyncAt) : "Chưa đồng bộ")}
        />
      </Stack>

      {/* Quản lý dữ liệu */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Quản lý dữ liệu
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<SyncRounded />}
          sx={{ textTransform: "none" }}
          onClick={() => setSyncOpen(true)}
        >
          Đồng bộ ngay
        </Button>
        <Button
          variant="outlined"
          startIcon={exporting ? <CircularProgress size={18} /> : <FileDownloadRounded />}
          sx={{ textTransform: "none" }}
          disabled={exporting || !statsQuery.isSuccess || totalRows === 0}
          onClick={handleExport}
        >
          Xuất / Sao lưu dữ liệu
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteRounded />}
          sx={{ textTransform: "none" }}
          disabled={totalRows === 0}
          onClick={() => setConfirmClearOpen(true)}
        >
          Xóa dữ liệu đã lưu
        </Button>
      </Stack>

      {/* Lưu trữ dữ liệu */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Lưu trữ dữ liệu
      </Typography>
      <FormControl size="small" sx={{ minWidth: 260 }}>
        <InputLabel id="retention-label">Thời gian lưu trữ hóa đơn</InputLabel>
        <Select
          labelId="retention-label"
          label="Thời gian lưu trữ hóa đơn"
          value={retention}
          onChange={(e) => setRetention(e.target.value)}
        >
          <MenuItem value="6">6 tháng</MenuItem>
          <MenuItem value="12">1 năm</MenuItem>
          <MenuItem value="24">2 năm</MenuItem>
          <MenuItem value="0">Không giới hạn</MenuItem>
        </Select>
      </FormControl>

      <SyncInvoiceDialog open={syncOpen} onClose={() => setSyncOpen(false)} />

      <Dialog open={confirmClearOpen} onClose={() => !clearMutation.isPending && setConfirmClearOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Xóa dữ liệu đã lưu</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Toàn bộ hóa đơn đã lưu (mua vào + bán ra) và lịch sử đồng bộ sẽ bị xóa khỏi cơ sở dữ
            liệu. Hành động này không ảnh hưởng đến dữ liệu gốc trên hệ thống Thuế điện tử, chỉ xóa
            bản lưu tại đây.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmClearOpen(false)} disabled={clearMutation.isPending}>
            Hủy
          </Button>
          <Button variant="contained" color="error" onClick={handleClear} disabled={clearMutation.isPending}>
            {clearMutation.isPending ? <CircularProgress size={20} color="inherit" /> : "Xóa"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

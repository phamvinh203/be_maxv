import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import Button from "@mui/material/Button";
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

interface AutomationToggle {
  key: string;
  label: string;
  description: string;
}

const AUTOMATION_TOGGLES: AutomationToggle[] = [
  {
    key: "autoDownload",
    label: "Tự động tải hóa đơn về khi có hóa đơn mới",
    description: "Kiểm tra và tải hóa đơn mua vào/bán ra mới phát sinh trên GDT theo định kỳ.",
  },
  {
    key: "autoSaveDb",
    label: "Tự động lưu hóa đơn vào cơ sở dữ liệu sau khi tra cứu",
    description: "Ghi kết quả tra cứu vào vct50view/vct60view thay vì chỉ hiển thị tạm thời.",
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

export default function SystemDataTab() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    autoDownload: false,
    autoSaveDb: false,
    autoSyncOnOpen: false,
  });
  const [retention, setRetention] = useState("12");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const toggle = (key: string) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Dữ liệu hệ thống
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Quản lý dữ liệu hóa đơn đã đồng bộ và cấu hình tự động hóa. (Giao diện minh họa — chưa nối
        chức năng thật.)
      </Typography>

      {/* Tự động hóa */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Tự động hóa
        </Typography>
        <Stack divider={<Divider />} spacing={1.5}>
          {AUTOMATION_TOGGLES.map((item, i) => (
            <Stack
              key={item.key}
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", justifyContent: "space-between", pt: i > 0 ? 1.5 : 0 }}
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
        <StatCard icon={<ReceiptRounded />} label="Hóa đơn mua vào đã lưu" value="0 hóa đơn" />
        <StatCard icon={<ReceiptLongRounded />} label="Hóa đơn bán ra đã lưu" value="0 hóa đơn" />
        <StatCard icon={<StorageRounded />} label="Dung lượng ước tính" value="0 MB" />
        <StatCard icon={<AccessTimeRounded />} label="Lần đồng bộ gần nhất" value="Chưa đồng bộ" />
      </Stack>

      {/* Quản lý dữ liệu */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Quản lý dữ liệu
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 3 }}>
        <Button variant="contained" startIcon={<SyncRounded />} sx={{ textTransform: "none" }}>
          Đồng bộ ngay
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileDownloadRounded />}
          sx={{ textTransform: "none" }}
        >
          Xuất / Sao lưu dữ liệu
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteRounded />}
          sx={{ textTransform: "none" }}
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

      <Dialog open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Xóa dữ liệu đã lưu</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Toàn bộ hóa đơn đã lưu trong cơ sở dữ liệu (vct50view/vct60view) sẽ bị xóa. Hành động
            này không ảnh hưởng đến dữ liệu gốc trên hệ thống Thuế điện tử, chỉ xóa bản lưu tại
            đây.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmClearOpen(false)}>Hủy</Button>
          <Button variant="contained" color="error" onClick={() => setConfirmClearOpen(false)}>
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

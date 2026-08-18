import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import FolderOpenRounded from "@mui/icons-material/FolderOpenRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import { toast } from "react-toastify";

import {
  pickDirectory,
  supportsDirectoryPicker,
  type FsDirHandle,
} from "../../../lib/fileSystemAccess";
import { getErrorMessage } from "../../../lib/errors";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Xuất file đối soát của khu Dịch vụ công.
 *
 * Ghi thẳng vào thư mục người dùng chọn qua File System Access API thay vì tải
 * từng file về Downloads — một lượt đối soát ra nhiều file, thả hết vào
 * Downloads thì người dùng phải tự gom lại.
 */
export default function XuatFileDvcDialog({ open, onClose }: Props) {
  const [tuNgay, setTuNgay] = useState("");
  const [denNgay, setDenNgay] = useState("");
  const [dir, setDir] = useState<FsDirHandle | null>(null);

  // Firefox và Safari chưa có File System Access API — không chọn thư mục được.
  const canPick = supportsDirectoryPicker();
  const canExport = !!tuNgay && !!denNgay && !!dir;

  const chonThuMuc = async () => {
    try {
      const d = await pickDirectory();
      if (d) setDir(d);
    } catch (e) {
      toast.error(getErrorMessage(e, "Không chọn được thư mục."));
    }
  };

  /**
   * Chưa xuất được gì: `be_maxv/src/services/client/dich_vu_cong/gdt-dvc.service.ts`
   * còn rỗng nên không có nguồn dữ liệu. Phần chọn thư mục thì chạy thật, khi
   * có API chỉ cần thay thân hàm này.
   */
  const xuatFile = () => {
    toast.info("Xuất file đối soát Dịch vụ công đang được phát triển.");
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        Thống kê giấy nộp tiền
        <IconButton size="small" onClick={onClose} aria-label="Đóng">
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Xuất file đối soát và tải tờ khai, giấy nộp tiền (dịch vụ công)
        </Typography>

        {!canPick && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Trình duyệt hiện tại không hỗ trợ chọn thư mục để lưu. Vui lòng dùng
            Chrome hoặc Edge.
          </Alert>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            type="date"
            fullWidth
            size="small"
            label="Từ ngày"
            slotProps={{ inputLabel: { shrink: true } }}
            value={tuNgay}
            onChange={(e) => setTuNgay(e.target.value)}
          />
          <TextField
            type="date"
            fullWidth
            size="small"
            label="Đến ngày"
            slotProps={{ inputLabel: { shrink: true } }}
            value={denNgay}
            onChange={(e) => setDenNgay(e.target.value)}
          />
        </Stack>

        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <Button
            variant="outlined"
            startIcon={<FolderOpenRounded />}
            onClick={chonThuMuc}
            disabled={!canPick}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Chọn thư mục lưu tải file ra
          </Button>
          <Typography
            variant="body2"
            sx={{
              color: dir ? "text.primary" : "text.secondary",
              wordBreak: "break-all",
            }}
          >
            {dir ? dir.name : "Chưa chọn thư mục"}
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          startIcon={<FileDownloadRounded />}
          onClick={xuatFile}
          disabled={!canExport}
          sx={{ textTransform: "none" }}
        >
          Xuất file
        </Button>
      </DialogActions>
    </Dialog>
  );
}

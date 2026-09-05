import type { ReactNode } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";

interface Props {
  open: boolean;
  tieuDe: string;
  noiDung: ReactNode;
  onClose: () => void;
  onXacNhan: () => void;
  /** Chữ trên nút xác nhận. Mặc định "Xóa" — đổi khi việc không phải là xóa bản ghi. */
  nhanXacNhan?: string;
}

/** Hỏi lại trước khi làm việc không lùi lại được — dùng chung cho khu HRM. */
export default function XacNhanXoaDialog({
  open,
  tieuDe,
  noiDung,
  onClose,
  onXacNhan,
  nhanXacNhan = "Xóa",
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{tieuDe}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{noiDung}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={onXacNhan}
          sx={{ textTransform: "none" }}
        >
          {nhanXacNhan}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

/** Lý do mở lại phải từ 20 ký tự (E-tkt-011) — chặn ngay ở đây cho khỏi bấm rồi mới lỗi. */
const TOI_THIEU = 20;

interface Props {
  open: boolean;
  thang: number;
  nam: number;
  dangChay: boolean;
  onClose: () => void;
  onXacNhan: (lyDo: string) => void;
}

export default function MoLaiBangTinhThueDialog({
  open,
  thang,
  nam,
  dangChay,
  onClose,
  onXacNhan,
}: Props) {
  const [lyDo, setLyDo] = useState("");
  const thieu = lyDo.trim().length < TOI_THIEU;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Mở lại Bảng tính thuế tháng {thang}/{nam}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="warning">
            Mở lại sẽ XÓA toàn bộ số thuế đã chốt của tháng và không hoàn tác được. Tờ khai quý chứa
            tháng này, nếu chưa xuất, cũng bị xóa theo cùng mọi ô chỉ tiêu kế toán đã ghi đè.
          </Alert>
          <TextField
            autoFocus
            required
            multiline
            minRows={2}
            label="Lý do mở lại"
            value={lyDo}
            onChange={(e) => setLyDo(e.target.value)}
            error={lyDo.length > 0 && thieu}
            helperText={`Ghi rõ vì sao phải mở lại — tối thiểu ${TOI_THIEU} ký tự (đang ${lyDo.trim().length}).`}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={dangChay}>
          Hủy
        </Button>
        <Button
          color="warning"
          variant="contained"
          disabled={thieu || dangChay}
          onClick={() => onXacNhan(lyDo.trim())}
        >
          {dangChay ? "Đang mở lại…" : "Mở lại tháng"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

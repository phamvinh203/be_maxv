import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { homNay } from "../../../_shared/format";
import type { DinhDangFile } from "../../../types/toKhaiThue";

/**
 * Hộp xác nhận xuất tờ khai — có ô Người ký và Ngày ký ngay tại đây (RVW-747).
 *
 * Hai trường này được ghi thẳng vào dòng tờ khai lúc xuất, mà xuất là việc không lùi lại được, nên
 * phải khai TRƯỚC khi bấm. Trước đây chúng chỉ có ô nhập ở hộp "Đánh dấu đã nộp" nên luồng thường
 * không có cách nào điền, còn giá trị gõ dở ở hộp kia lại lặng lẽ đi vào tờ khai chính thức.
 */
interface Props {
  open: boolean;
  nam: number;
  quy: number;
  format: DinhDangFile;
  /** Người ký đã lưu ở hồ sơ người nộp thuế, dùng làm giá trị gợi ý. */
  nguoiKyMacDinh: string | null;
  dangChay: boolean;
  onClose: () => void;
  onXacNhan: (nguoiKy: string, ngayKy: string) => void;
}

export default function XuatToKhaiDialog({
  open,
  nam,
  quy,
  format,
  nguoiKyMacDinh,
  dangChay,
  onClose,
  onXacNhan,
}: Props) {
  const [nguoiKy, setNguoiKy] = useState(nguoiKyMacDinh ?? "");
  const [ngayKy, setNgayKy] = useState(homNay());

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Xuất tờ khai quý {quy}/{nam} ({format === "pdf" ? "PDF" : "Excel"})
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="warning">
            Sau khi xuất, ba tháng trong quý VĨNH VIỄN không mở lại được và bộ chỉ tiêu không sửa
            được nữa. Chỉ xuất khi đã đối chiếu xong số liệu.
          </Alert>
          <TextField
            label="Người ký"
            value={nguoiKy}
            onChange={(e) => setNguoiKy(e.target.value)}
            helperText="Ghi vào tờ khai chính thức. Bỏ trống thì giữ người ký đã lưu ở hồ sơ."
          />
          <TextField
            type="date"
            label="Ngày ký"
            value={ngayKy}
            onChange={(e) => setNgayKy(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={dangChay}>
          Hủy
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={dangChay}
          onClick={() => onXacNhan(nguoiKy.trim(), ngayKy)}
        >
          {dangChay ? "Đang xuất…" : "Xuất tờ khai"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { chiSo, tienVn } from "../../../_shared/format";
import type { CtTagTncn05 } from "../../../types/toKhaiThue";

/** Máy chủ đòi lý do từ 10 ký tự cho TỪNG chỉ tiêu (E-tkt-011). */
const LY_DO_TOI_THIEU = 10;

interface Props {
  open: boolean;
  onClose: () => void;
  tag: CtTagTncn05 | null;
  tenChiTieu: string;
  donVi: "Người" | "VNĐ";
  giaTriMay: number;
  ghiDeHienTai?: { gia: number; lyDo: string };
  onSave: (gia: number, lyDo: string) => Promise<void>;
  onReset: () => Promise<void>;
  isLocked?: boolean;
}

export default function ToKhaiOverrideDialog({
  open,
  onClose,
  tag,
  tenChiTieu,
  donVi,
  giaTriMay,
  ghiDeHienTai,
  onSave,
  onReset,
  isLocked = false,
}: Props) {
  const [giaStr, setGiaStr] = useState("0");
  const [lyDo, setLyDo] = useState("");
  const [isSaving, setIsSaving] = useState(false);

/* eslint-disable react-hooks/set-state-in-effect -- nạp lại form mỗi lần MỞ dialog, cố ý reset theo prop nguồn (cùng khuôn `useFormDialog` của khu HRM) */
  useEffect(() => {
    if (!open) return;
    if (ghiDeHienTai) {
      setGiaStr(String(ghiDeHienTai.gia));
      setLyDo(ghiDeHienTai.lyDo || "");
    } else {
      setGiaStr(String(giaTriMay));
      setLyDo("");
    }
  }, [open, ghiDeHienTai, giaTriMay]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const maChiTieu = tag ? tag.replace("ct", "[") + "]" : "";
  const lyDoNgan = lyDo.trim().length < LY_DO_TOI_THIEU;
  /** Chỉ tiêu [16]…[20] là SỐ NGƯỜI nên phải nguyên — máy chủ trả E-tkt-012 nếu gửi số lẻ. */
  const demNguoi = donVi === "Người";

  const handleSave = async () => {
    if (lyDoNgan) return;
    const gia = chiSo(giaStr);
    setIsSaving(true);
    try {
      await onSave(gia, lyDo.trim());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await onReset();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Điều chỉnh chỉ tiêu {maChiTieu}
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Nội dung chỉ tiêu
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {tenChiTieu}
            </Typography>
          </Box>

          <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Số máy tự động tính:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {tienVn(giaTriMay)} {donVi}
              </Typography>
            </Stack>
          </Paper>

          {isLocked && (
            <Alert severity="warning">
              Tờ khai này đã ở trạng thái <strong>Đã chốt</strong>. Không thể chỉnh sửa số liệu.
            </Alert>
          )}

          <TextField
            fullWidth
            label={`Giá trị điều chỉnh mới (${donVi}${demNguoi ? ", số nguyên" : ""})`}
            value={tienVn(chiSo(giaStr))}
            onChange={(e) => setGiaStr(e.target.value)}
            disabled={isLocked || isSaving}
            slotProps={{
              htmlInput: {
                style: { fontWeight: 700, fontSize: "1.2rem", textAlign: "right" },
              },
            }}
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Lý do giải trình điều chỉnh (bắt buộc)"
            placeholder="Nêu rõ căn cứ điều chỉnh so với số máy tính…"
            required
            value={lyDo}
            onChange={(e) => setLyDo(e.target.value)}
            disabled={isLocked || isSaving}
            error={lyDo.length > 0 && lyDoNgan}
            helperText={`Tối thiểu ${LY_DO_TOI_THIEU} ký tự (đang ${lyDo.trim().length}) — lý do được lưu cùng số đã sửa.`}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
        <Box>
          {ghiDeHienTai && !isLocked && (
            <Button
              color="warning"
              onClick={handleReset}
              disabled={isSaving}
            >
              Đặt lại về số máy
            </Button>
          )}
        </Box>

        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} color="inherit" disabled={isSaving}>
            Hủy bỏ
          </Button>
          {!isLocked && (
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={isSaving || lyDoNgan}
            >
              {isSaving ? "Đang lưu..." : "Lưu điều chỉnh"}
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

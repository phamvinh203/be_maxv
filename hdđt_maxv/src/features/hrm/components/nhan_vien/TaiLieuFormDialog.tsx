import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import { getErrorMessage } from "../../../../lib/errors";
import { LOAI_TAI_LIEU } from "../../constants";
import { taiLieuRong } from "../../formDefaults";
import { useLuuTaiLieu } from "../../api/taiLieuQueries";
import type { LoaiTaiLieu, TaiLieu, TaiLieuFormValues } from "../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  maNv: string;
  /** Có giá trị = sửa tài liệu này. */
  taiLieu?: TaiLieu;
}

export default function TaiLieuFormDialog({ open, onClose, maNv, taiLieu }: Props) {
  const laSua = Boolean(taiLieu);
  const luuTaiLieu = useLuuTaiLieu();

  const [values, setValues] = useState<TaiLieuFormValues>(taiLieuRong);
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(
      taiLieu
        ? {
            loai: taiLieu.loai,
            so_hieu: taiLieu.so_hieu,
            ngay_cap: taiLieu.ngay_cap,
            noi_cap: taiLieu.noi_cap,
            ghi_chu: taiLieu.ghi_chu,
          }
        : taiLieuRong(),
    );
  }, [open, taiLieu]);

  const dat = <K extends keyof TaiLieuFormValues>(khoa: K, giaTri: TaiLieuFormValues[K]) =>
    setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  const handleSubmit = async () => {
    setDangLuu(true);
    try {
      await luuTaiLieu(maNv, values, taiLieu?.id);
      toast.success(laSua ? "Đã cập nhật tài liệu." : "Đã thêm tài liệu.");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được tài liệu."));
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{laSua ? "Sửa tài liệu" : "Thêm tài liệu"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            Bản này chỉ lưu thông tin tài liệu dạng chữ. Đính kèm ảnh CCCD và file quét sẽ có ở
            bản sau.
          </Alert>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              select
              label="Loại tài liệu"
              required
              size="small"
              value={values.loai}
              onChange={(e) => dat("loai", e.target.value as LoaiTaiLieu)}
            >
              {LOAI_TAI_LIEU.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Số hiệu"
              size="small"
              value={values.so_hieu}
              onChange={(e) => dat("so_hieu", e.target.value)}
            />
            <TextField
              label="Ngày cấp"
              type="date"
              size="small"
              value={values.ngay_cap}
              onChange={(e) => dat("ngay_cap", e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Nơi cấp"
              size="small"
              value={values.noi_cap}
              onChange={(e) => dat("noi_cap", e.target.value)}
            />
            <Box sx={{ gridColumn: "1 / -1" }}>
              <TextField
                label="Ghi chú"
                fullWidth
                size="small"
                value={values.ghi_chu}
                onChange={(e) => dat("ghi_chu", e.target.value)}
              />
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={dangLuu}
          sx={{ textTransform: "none" }}
        >
          {laSua ? "Lưu thay đổi" : "Thêm tài liệu"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

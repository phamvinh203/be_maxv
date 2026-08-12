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
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { getErrorMessage } from "../../../../../lib/errors";
import { LOAI_NGAY_LE } from "../../../constants";
import { ngayLeRong } from "../../../formDefaults";
import { useLuuNgayLe } from "../../../mock/hooks/ngayLe";
import type { LoaiNgayLe, NgayLe, NgayLeFormValues } from "../../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Có giá trị = sửa ngày lễ này. */
  ngayLe?: NgayLe;
}

export default function NgayLeFormDialog({ open, onClose, ngayLe }: Props) {
  const laSua = Boolean(ngayLe);
  const luuNgayLe = useLuuNgayLe();

  const [values, setValues] = useState<NgayLeFormValues>(ngayLeRong);
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(
      ngayLe
        ? {
            ngay: ngayLe.ngay,
            ten: ngayLe.ten,
            loai: ngayLe.loai,
            lap_lai_hang_nam: ngayLe.lap_lai_hang_nam,
            co_luong: ngayLe.co_luong,
            ghi_chu: ngayLe.ghi_chu,
          }
        : ngayLeRong(),
    );
  }, [open, ngayLe]);

  const dat = <K extends keyof NgayLeFormValues>(khoa: K, giaTri: NgayLeFormValues[K]) =>
    setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  // Đổi sang lễ âm lịch thì tắt luôn cờ lặp — ngày dương của nó đổi mỗi năm.
  const doiLoai = (loai: LoaiNgayLe) =>
    setValues((cu) => ({
      ...cu,
      loai,
      lap_lai_hang_nam: loai === "le_am_lich" ? false : cu.lap_lai_hang_nam,
    }));

  const handleSubmit = async () => {
    setDangLuu(true);
    try {
      await luuNgayLe(values, ngayLe?.id);
      toast.success(laSua ? "Đã cập nhật ngày lễ." : "Đã thêm ngày lễ.");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được ngày lễ."));
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{laSua ? "Sửa ngày lễ" : "Thêm ngày lễ"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <TextField
            label="Tên ngày lễ"
            required
            autoFocus
            fullWidth
            size="small"
            value={values.ten}
            onChange={(e) => dat("ten", e.target.value)}
          />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              select
              label="Loại lễ"
              size="small"
              value={values.loai}
              onChange={(e) => doiLoai(e.target.value as LoaiNgayLe)}
            >
              {LOAI_NGAY_LE.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Ngày"
              type="date"
              required
              size="small"
              value={values.ngay}
              onChange={(e) => dat("ngay", e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>

          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.lap_lai_hang_nam}
                  disabled={values.loai === "le_am_lich"}
                  onChange={(e) => dat("lap_lai_hang_nam", e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Lặp lại mọi năm (theo dương lịch)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {values.loai === "le_am_lich"
                      ? "Lễ âm lịch có ngày dương đổi mỗi năm nên phải tạo lại từng năm."
                      : "Ngày này tự áp cho mọi năm, không cần tạo lại."}
                  </Typography>
                </Box>
              }
              sx={{ display: "flex", alignItems: "flex-start", mb: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.co_luong}
                  onChange={(e) => dat("co_luong", e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Có lương</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Nhân viên vẫn được tính đủ công cho ngày nghỉ này.
                  </Typography>
                </Box>
              }
              sx={{ display: "flex", alignItems: "flex-start" }}
            />
          </Box>

          <TextField
            label="Ghi chú"
            fullWidth
            multiline
            minRows={2}
            size="small"
            value={values.ghi_chu}
            onChange={(e) => dat("ghi_chu", e.target.value)}
          />
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
          {laSua ? "Lưu thay đổi" : "Thêm ngày lễ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

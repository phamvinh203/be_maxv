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
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { getErrorMessage } from "../../../../lib/errors";
import { KIEU_LUONG, LOAI_HD } from "../../constants";
import { hopDongRong } from "../../formDefaults";
import { useLuuHopDong } from "../../mock/hooks/hopDong";
import type { HopDong, HopDongFormValues, KieuLuong, LoaiHopDong } from "../../types";
import TienField from "../TienField";

interface Props {
  open: boolean;
  onClose: () => void;
  maNv: string;
  /** Có giá trị = sửa hợp đồng này. */
  hopDong?: HopDong;
}

export default function HopDongFormDialog({ open, onClose, maNv, hopDong }: Props) {
  const laSua = Boolean(hopDong);
  const luuHopDong = useLuuHopDong();

  const [values, setValues] = useState<HopDongFormValues>(hopDongRong);
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(
      hopDong
        ? {
            so_hd: hopDong.so_hd,
            loai_hd: hopDong.loai_hd,
            kieu_luong: hopDong.kieu_luong,
            luong_chinh: hopDong.luong_chinh,
            luong_bhxh: hopDong.luong_bhxh,
            ngay_bat_dau: hopDong.ngay_bat_dau,
            ngay_ket_thuc: hopDong.ngay_ket_thuc,
            trich_bhxh: hopDong.trich_bhxh,
            tinh_tncn: hopDong.tinh_tncn,
            ghi_chu: hopDong.ghi_chu,
          }
        : hopDongRong(),
    );
  }, [open, hopDong]);

  const dat = <K extends keyof HopDongFormValues>(khoa: K, giaTri: HopDongFormValues[K]) =>
    setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  const handleSubmit = async () => {
    setDangLuu(true);
    try {
      await luuHopDong(maNv, values, hopDong?.id);
      toast.success(laSua ? "Đã cập nhật hợp đồng." : "Đã thêm hợp đồng.");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được hợp đồng."));
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{laSua ? "Sửa hợp đồng" : "Thêm hợp đồng"}</DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
            gap: 2,
          }}
        >
          <TextField
            label="Số hợp đồng"
            required
            autoFocus
            size="small"
            value={values.so_hd}
            onChange={(e) => dat("so_hd", e.target.value)}
          />
          <TextField
            select
            label="Loại hợp đồng"
            size="small"
            value={values.loai_hd}
            onChange={(e) => dat("loai_hd", e.target.value as LoaiHopDong)}
          >
            {LOAI_HD.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Kiểu lương"
            size="small"
            value={values.kieu_luong}
            onChange={(e) => dat("kieu_luong", e.target.value as KieuLuong)}
          >
            {KIEU_LUONG.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TienField
            label="Lương chính"
            value={values.luong_chinh}
            onChange={(v) => dat("luong_chinh", v)}
          />
          <TienField
            label="Lương đóng BHXH"
            value={values.luong_bhxh}
            onChange={(v) => dat("luong_bhxh", v)}
            helperText="Gốc tính phí công đoàn 1%."
          />
          <Box />
          <TextField
            label="Ngày bắt đầu"
            type="date"
            required
            size="small"
            value={values.ngay_bat_dau}
            onChange={(e) => dat("ngay_bat_dau", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Ngày kết thúc"
            type="date"
            size="small"
            value={values.ngay_ket_thuc}
            onChange={(e) => dat("ngay_ket_thuc", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Để trống nếu không xác định thời hạn."
          />
          <Box />
          <Box sx={{ gridColumn: "1 / -1" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={values.trich_bhxh}
                    onChange={(e) => dat("trich_bhxh", e.target.checked)}
                  />
                }
                label="Trích đóng BHXH"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={values.tinh_tncn}
                    onChange={(e) => dat("tinh_tncn", e.target.checked)}
                  />
                }
                label="Tính thuế TNCN"
              />
            </Stack>
          </Box>
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
          {laSua ? "Lưu thay đổi" : "Thêm hợp đồng"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Box from "@mui/material/Box";
import { getErrorMessage } from "../../../../lib/errors";
import { TRANG_THAI_PB, moTaLoaiKhoan } from "../../constants";
import { khoanLuongRong } from "../../formDefaults";
import { useLuuKhoanLuong } from "../../mock/hooks/khoanLuong";
import type {
  KhoanLuong,
  KhoanLuongFormValues,
  LoaiKhoanLuong,
  TrangThai,
} from "../../types";
import SoField from "../cau_hinh/SoField";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Loại khoản cần tạo — quyết định nhãn và các ô hiện ra. */
  loai: LoaiKhoanLuong;
  /** Có giá trị = sửa khoản này. */
  khoan?: KhoanLuong;
}

/**
 * Dialog dùng chung cho cả bảy loại khoản lương.
 *
 * Nhãn và các ô hiện ra đọc từ bảng mô tả trong `constants.ts` — bảy loại chỉ
 * khác nhau ở phần đó, nên viết bảy dialog gần như giống hệt là nhân bảy chỗ
 * phải sửa mỗi lần đổi một dòng.
 */
export default function KhoanLuongFormDialog({ open, onClose, loai, khoan }: Props) {
  const laSua = Boolean(khoan);
  const moTa = moTaLoaiKhoan(khoan?.loai ?? loai);
  const luuKhoan = useLuuKhoanLuong();

  const [values, setValues] = useState<KhoanLuongFormValues>(() => khoanLuongRong(loai));
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(
      khoan
        ? {
            loai: khoan.loai,
            ten_khoan: khoan.ten_khoan,
            ghi_chu: khoan.ghi_chu,
            tinh_bhxh: khoan.tinh_bhxh,
            chiu_thue_tncn: khoan.chiu_thue_tncn,
            ty_le: khoan.ty_le,
            status: khoan.status,
          }
        : khoanLuongRong(loai),
    );
  }, [open, khoan, loai]);

  const dat = <K extends keyof KhoanLuongFormValues>(
    khoa: K,
    giaTri: KhoanLuongFormValues[K],
  ) => setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  const handleSubmit = async () => {
    setDangLuu(true);
    try {
      await luuKhoan(values, khoan?.ma_khoan);
      toast.success(laSua ? "Đã cập nhật khoản lương." : `Đã tạo ${moTa.label.toLowerCase()}.`);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được khoản lương."));
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        {laSua ? `Sửa khoản ${khoan?.ma_khoan}` : moTa.nhanNut}
      </DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 2 }}>
        {moTa.moTa}
      </Typography>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <TextField
            label={moTa.nhanTen}
            required
            autoFocus
            fullWidth
            size="small"
            value={values.ten_khoan}
            onChange={(e) => dat("ten_khoan", e.target.value)}
          />

          <TextField
            label={moTa.nhanGhiChu}
            fullWidth
            multiline
            minRows={2}
            size="small"
            value={values.ghi_chu}
            onChange={(e) => dat("ghi_chu", e.target.value)}
          />

          {moTa.coTyLe && (
            <SoField
              label="Tỷ lệ mặc định"
              donVi="%"
              buocNhay={0.5}
              value={values.ty_le}
              onChange={(v) => dat("ty_le", v)}
              helperText="Tỷ lệ gợi ý khi áp khoản này cho một nhân viên; sửa lại được từng người."
            />
          )}

          <Box>
            {moTa.coBhxh && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={values.tinh_bhxh}
                    onChange={(e) => dat("tinh_bhxh", e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Tính vào lương đóng BHXH</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Khoản này cộng vào gốc tính BHXH và phí công đoàn.
                    </Typography>
                  </Box>
                }
                sx={{ display: "flex", alignItems: "flex-start", mb: 1 }}
              />
            )}
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.chiu_thue_tncn}
                  onChange={(e) => dat("chiu_thue_tncn", e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Chịu thuế TNCN</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Khoản này cộng vào thu nhập chịu thuế thu nhập cá nhân.
                  </Typography>
                </Box>
              }
              sx={{ display: "flex", alignItems: "flex-start" }}
            />
          </Box>

          {/* Chỉ có ở chế độ sửa — khoản mới luôn đang dùng. */}
          {laSua && (
            <TextField
              select
              label="Trạng thái"
              fullWidth
              size="small"
              value={values.status}
              onChange={(e) => dat("status", e.target.value as TrangThai)}
              helperText="Ngừng dùng để giữ lại khoản đã áp cho các kỳ lương cũ."
            >
              {TRANG_THAI_PB.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          )}
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
          {laSua ? "Lưu thay đổi" : "Tạo khoản"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

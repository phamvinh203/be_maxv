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
import { TRANG_THAI_PB, moTaLoaiKhoan } from "../../_shared/constants";
import { khoanLuongRong } from "../../_shared/formDefaults";
import { useLuuKhoanLuong } from "../../api/cai_dat_luong/salaryItemsQueries";
import type {
  KhoanLuong,
  KhoanLuongFormValues,
  LoaiKhoanLuong,
  TrangThai,
} from "../../types";
import SoField from "../SoField";
import { useFormDialog } from "../useFormDialog";

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

  const { values, dat, dangLuu, handleSubmit } = useFormDialog<KhoanLuongFormValues>({
    open,
    onClose,
    khoiTao: () =>
      khoan
        ? {
            loai: khoan.loai,
            ten_khoan: khoan.ten_khoan,
            ghi_chu: khoan.ghi_chu,
            tinh_bhxh: khoan.tinh_bhxh,
            chiu_thue_tncn: khoan.chiu_thue_tncn,
            ty_le: khoan.ty_le,
            phu_cap_an_trua: khoan.phu_cap_an_trua,
            status: khoan.status,
          }
        : khoanLuongRong(loai),
    // RVW-A08: trước đây bấm Lưu với tên khoản trống tốn 1 round-trip mới nhận lỗi 400 chung chung.
    soat: (v) => (v.ten_khoan.trim() ? undefined : `Nhập ${moTa.nhanTen.toLowerCase()}.`),
    luu: (v) => luuKhoan(v, khoan?.ma_khoan),
    thongBaoThanhCong: laSua ? "Đã cập nhật khoản lương." : `Đã tạo ${moTa.label.toLowerCase()}.`,
    thongBaoLoiMacDinh: "Không lưu được khoản lương.",
  });

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
              sx={{ display: "flex", alignItems: "flex-start", mb: moTa.coMienAnTrua ? 1 : 0 }}
            />
            {moTa.coMienAnTrua && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={values.phu_cap_an_trua}
                    onChange={(e) => dat("phu_cap_an_trua", e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">
                      Phụ cấp ăn trưa (miễn thuế trong hạn mức)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Phần trong trần miễn thuế ở Cấu hình mặc định được trừ khỏi thu nhập chịu
                      thuế; phần vượt trần vẫn tính thuế bình thường.
                    </Typography>
                  </Box>
                }
                sx={{ display: "flex", alignItems: "flex-start" }}
              />
            )}
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

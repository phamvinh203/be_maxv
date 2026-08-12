import { useEffect, useState, type KeyboardEvent } from "react";
import Popover from "@mui/material/Popover";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import { alpha } from "@mui/material/styles";
import { LOAI_CONG, moTaLoaiCong } from "../../../constants";
import { nhanThu, type NgayCham } from "../../../chamCong";
import { ngayVn } from "../../../format";
import type { LoaiCong, OChamCong } from "../../../types";

interface Props {
  /** Ô đang mở; `null` = đóng popover. */
  neo: HTMLElement | null;
  tenNhanVien: string;
  ngayCham: NgayCham | null;
  giaTri: OChamCong | null;
  gioCongChuanNgay: number;
  onClose: () => void;
  onLuu: (o: OChamCong) => void;
  /** Xóa trắng ô. */
  onXoa: () => void;
}

/**
 * Bảng chọn loại công của một ô, nổi ngay tại ô vừa bấm.
 *
 * Tám loại bấm được bằng phím 1–8: chấm công cả tháng cho vài chục người mà
 * phải rê chuột từng ô thì quá chậm. Enter lưu, Esc đóng.
 */
export default function OChamCongPopover({
  neo,
  tenNhanVien,
  ngayCham,
  giaTri,
  gioCongChuanNgay,
  onClose,
  onLuu,
  onXoa,
}: Props) {
  const [loai, setLoai] = useState<LoaiCong>("lam_viec");
  const [soGio, setSoGio] = useState("");

  useEffect(() => {
    if (!neo) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoai(giaTri?.loai ?? "lam_viec");
    setSoGio(giaTri?.soGio ? String(giaTri.soGio) : "");
  }, [neo, giaTri]);

  if (!ngayCham) return null;

  const gio = Number(soGio);
  const gioHopLe = soGio === "" || (Number.isFinite(gio) && gio >= 0 && gio <= gioCongChuanNgay);
  const chapNhanGio = moTaLoaiCong(loai).tinhCong;

  const luu = () => {
    if (!gioHopLe) return;
    onLuu({ loai, soGio: chapNhanGio && soGio !== "" ? gio : 0 });
  };

  const batPhim = (e: KeyboardEvent) => {
    const khop = LOAI_CONG.find((item) => item.phim === e.key);
    if (khop) {
      e.preventDefault();
      setLoai(khop.value);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      luu();
    }
  };

  return (
    <Popover
      open={Boolean(neo)}
      anchorEl={neo}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      transformOrigin={{ vertical: "top", horizontal: "center" }}
      slotProps={{ paper: { sx: { p: 2, width: 340 }, onKeyDown: batPhim } }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {tenNhanVien}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {ngayVn(ngayCham.ngay)} ({nhanThu(ngayCham.thu)})
        {ngayCham.tenNgayLe ? ` — ${ngayCham.tenNgayLe}` : ""}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 1,
          mt: 2,
        }}
      >
        {LOAI_CONG.map((item) => {
          const dangChon = item.value === loai;
          return (
            <ButtonBase
              key={item.value}
              onClick={() => setLoai(item.value)}
              sx={{
                justifyContent: "flex-start",
                gap: 1,
                px: 1,
                py: 0.75,
                borderRadius: 1,
                border: "1px solid",
                borderColor: dangChon ? "primary.main" : "divider",
                bgcolor: (theme) =>
                  dangChon ? alpha(theme.palette.primary.main, 0.1) : "transparent",
              }}
            >
              <Box
                sx={{
                  minWidth: 30,
                  px: 0.5,
                  py: 0.25,
                  borderRadius: 0.75,
                  fontSize: 12,
                  fontWeight: 700,
                  color: item.mau === "default" ? "text.primary" : `${item.mau}.contrastText`,
                  bgcolor: item.mau === "default" ? "action.selected" : `${item.mau}.main`,
                }}
              >
                {item.kyHieu}
              </Box>
              <Typography variant="body2" sx={{ flexGrow: 1, textAlign: "left" }}>
                {item.label}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {item.phim}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>

      <Divider sx={{ my: 2 }} />

      <TextField
        label="Nhập số giờ làm cụ thể"
        type="number"
        size="small"
        fullWidth
        value={soGio}
        onChange={(e) => setSoGio(e.target.value)}
        disabled={!chapNhanGio}
        error={!gioHopLe}
        helperText={
          !gioHopLe
            ? `Số giờ phải từ 0 đến ${gioCongChuanNgay}.`
            : chapNhanGio
              ? `Tối đa ${gioCongChuanNgay}h (giờ công chuẩn). Để trống thì tính theo loại đã chọn.`
              : "Loại này không tính vào ngày công nên không cần số giờ."
        }
        slotProps={{
          htmlInput: { step: 0.5, min: 0, max: gioCongChuanNgay },
          input: { endAdornment: <InputAdornment position="end">giờ</InputAdornment> },
        }}
        onWheel={(e) => (e.target as HTMLElement).blur()}
      />

      <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "space-between" }}>
        <Button color="error" onClick={onXoa} sx={{ textTransform: "none" }}>
          Xóa ô
        </Button>
        <Button
          variant="contained"
          onClick={luu}
          disabled={!gioHopLe}
          sx={{ textTransform: "none" }}
        >
          Lưu
        </Button>
      </Stack>
    </Popover>
  );
}

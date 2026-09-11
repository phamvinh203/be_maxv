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
import { TRANG_THAI_PB } from "../../../_shared/constants";
import { soGioCa } from "../../../_shared/format";
import { caLamViecRong } from "../../../_shared/formDefaults";
import {
  CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD,
  useLuuCaLamViec,
} from "../../../api/cau_hinh_mac_dinh/workShiftsQueries";
import type { CaLamViec, CaLamViecFormValues, TrangThai } from "../../../types";
import SoField from "../../SoField";
import { useFormDialog } from "../../useFormDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Có giá trị = sửa ca này. */
  ca?: CaLamViec;
}

export default function CaLamViecFormDialog({ open, onClose, ca }: Props) {
  const laSua = Boolean(ca);
  const luuCa = useLuuCaLamViec();

  const { values, dat, dangLuu, handleSubmit } = useFormDialog<CaLamViecFormValues>({
    open,
    onClose,
    khoiTao: () =>
      ca
        ? {
            ten_ca: ca.ten_ca,
            gio_vao: ca.gio_vao,
            gio_ra: ca.gio_ra,
            nghi_giua_ca: ca.nghi_giua_ca,
            status: ca.status,
          }
        : caLamViecRong(),
    // RVW-A08: trước đây bấm Lưu với tên ca trống tốn 1 round-trip mới nhận lỗi 400 chung chung.
    soat: (v) => (v.ten_ca.trim() ? undefined : "Nhập tên ca."),
    luu: async (v) => {
      // Cảnh báo do máy chủ sinh (`workingHours > 12`), không tự tính lại ở đây. Vắng mặt là
      // chuyện bình thường — mã cũ của máy chủ chưa trả trường này, giao diện vẫn phải chạy.
      const canhBao = await luuCa(v, ca?.ma_ca);
      if (canhBao === CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD) {
        toast.warning(
          "Ca này vượt trần 12 giờ/ngày theo Điều 105 & 107 BLLĐ 2019. Đã lưu, nhưng hãy rà lại nếu không phải ca trực đặc thù.",
        );
      }
    },
    thongBaoThanhCong: laSua ? "Đã cập nhật ca làm việc." : "Đã thêm ca làm việc.",
    thongBaoLoiMacDinh: "Không lưu được ca làm việc.",
  });

  const soGio = soGioCa(values.gio_vao, values.gio_ra, values.nghi_giua_ca);
  const quaDem = Boolean(values.gio_vao && values.gio_ra && values.gio_ra <= values.gio_vao);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{laSua ? `Sửa ca ${ca?.ma_ca}` : "Thêm ca làm việc"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
              <TextField
                label="Tên ca"
                required
                autoFocus
                fullWidth
                size="small"
                value={values.ten_ca}
                onChange={(e) => dat("ten_ca", e.target.value)}
              />
            </Box>
            <TextField
              label="Giờ vào"
              type="time"
              size="small"
              value={values.gio_vao}
              onChange={(e) => dat("gio_vao", e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Giờ ra"
              type="time"
              size="small"
              value={values.gio_ra}
              onChange={(e) => dat("gio_ra", e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <SoField
              label="Nghỉ giữa ca"
              donVi="phút"
              buocNhay={15}
              value={values.nghi_giua_ca}
              onChange={(v) => dat("nghi_giua_ca", v)}
            />
            <TextField
              select
              label="Trạng thái"
              size="small"
              value={values.status}
              onChange={(e) => dat("status", e.target.value as TrangThai)}
            >
              {TRANG_THAI_PB.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Alert severity={soGio > 0 ? "info" : "warning"}>
            Số giờ công của ca: <strong>{soGio} giờ</strong>
            {quaDem && " — ca qua đêm, giờ ra thuộc ngày hôm sau."}
          </Alert>
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
          {laSua ? "Lưu thay đổi" : "Thêm ca"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

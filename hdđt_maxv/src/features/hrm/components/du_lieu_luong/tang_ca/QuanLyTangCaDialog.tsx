import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { getErrorMessage } from "../../../../../lib/errors";
import { LOAI_TANG_CA } from "../../../constants";
import { useCauHinh, useLuuCauHinh } from "../../../mock/hooks/cauHinh";
import type { CauHinhMacDinh } from "../../../types";
import SoField from "../../cau_hinh/SoField";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Các ô của Cấu hình mặc định mà dialog này đụng tới — liệt kê thẳng thay vì
 * `keyof CauHinhMacDinh` để không lỡ ghi một con số vào `bac_thue`.
 */
type KhoaSoTangCa =
  | (typeof LOAI_TANG_CA)[number]["truong"]
  | "gioi_han_tc_thang"
  | "nguong_canh_bao_tc_nam"
  | "nguong_vuot_muc_tc_nam";

/**
 * Hệ số và trần giờ tăng ca.
 *
 * Sửa thẳng vào **Cấu hình mặc định** — đây là đúng những ô của tab "Thiết lập
 * chung", mở lại ở đây cho đỡ phải đi vòng khi đang nhập giờ. Không dựng bản sao
 * riêng cho màn hình này: hai nơi giữ hai bộ hệ số thì cùng một giờ làm sẽ quy
 * đổi ra hai con số khác nhau.
 */
export default function QuanLyTangCaDialog({ open, onClose }: Props) {
  const daLuu = useCauHinh();
  const luuCauHinh = useLuuCauHinh();

  const [values, setValues] = useState<CauHinhMacDinh>(daLuu);
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Mở lại thì lấy bản đang lưu — không giữ nửa chừng bản nháp của lần trước.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(daLuu);
  }, [open, daLuu]);

  const dat = (khoa: KhoaSoTangCa, giaTri: number) =>
    setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  const handleLuu = async () => {
    setDangLuu(true);
    try {
      await luuCauHinh(values);
      toast.success("Đã lưu hệ số và trần giờ tăng ca.");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được cấu hình tăng ca."));
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Quản lý tăng ca</DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 2 }}>
        Hệ số quyết định cột "Quy đổi" của bảng tăng ca. Đây là cùng các ô ở tab Cấu hình mặc
        định › Thiết lập chung — sửa ở đây là sửa cho toàn công ty.
      </Typography>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Hệ số tăng ca
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
              }}
            >
              {LOAI_TANG_CA.map((item) => (
                <SoField
                  key={item.value}
                  label={item.label}
                  donVi="%"
                  buocNhay={10}
                  value={values[item.truong]}
                  onChange={(so) => dat(item.truong, so)}
                />
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Giới hạn giờ tăng ca
            </Typography>
            <Stack spacing={2}>
              <SoField
                label="Trần giờ tăng ca mỗi tháng"
                donVi="giờ"
                value={values.gioi_han_tc_thang}
                onChange={(so) => dat("gioi_han_tc_thang", so)}
                helperText="Tổng giờ OT của bảng vượt mức này sẽ bị tô đỏ."
              />
              <SoField
                label="Ngưỡng cảnh báo trong năm"
                donVi="giờ"
                buocNhay={10}
                value={values.nguong_canh_bao_tc_nam}
                onChange={(so) => dat("nguong_canh_bao_tc_nam", so)}
              />
              <SoField
                label="Ngưỡng vượt mức trong năm"
                donVi="giờ"
                buocNhay={10}
                value={values.nguong_vuot_muc_tc_nam}
                onChange={(so) => dat("nguong_vuot_muc_tc_nam", so)}
                helperText="Cột 'Tổng giờ năm' vượt mức này sẽ bị tô đỏ."
              />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={handleLuu}
          disabled={dangLuu}
          sx={{ textTransform: "none" }}
        >
          Lưu thay đổi
        </Button>
      </DialogActions>
    </Dialog>
  );
}

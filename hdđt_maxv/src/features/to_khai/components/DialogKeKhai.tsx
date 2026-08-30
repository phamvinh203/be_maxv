import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { toast } from "react-toastify";
import { useKeKhaiMutation } from "../api/toKhaiQueries";
import { kyMacDinh, kyToQuery, nhanKy, soKyToiDa, type Ky, type KyLoai } from "../ky";
import { getErrorMessage } from "../../../lib/errors";

/**
 * Dialog "Kê khai" mở từ màn Hóa đơn điện tử: chọn kỳ rồi gán mọi hóa đơn có ngày lập trong kỳ
 * vào kỳ đó, xong thì chuyển thẳng sang màn Tờ khai mở đúng kỳ vừa chọn.
 *
 * Đặt ở `features/to_khai` chứ không ở `features/hddt` dù nút mở nó nằm bên hóa đơn: nghiệp vụ kê
 * khai thuộc mô-đun này, và như vậy mô-đun hóa đơn chỉ phụ thuộc đúng một component.
 */
export default function DialogKeKhai({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [ky, setKy] = useState<Ky>(kyMacDinh);
  const keKhai = useKeKhaiMutation();
  const navigate = useNavigate();

  const namHienTai = new Date().getFullYear();
  const danhSachNam = Array.from({ length: 6 }, (_, i) => namHienTai - i);
  const danhSachKySo = Array.from({ length: soKyToiDa(ky.kyLoai) }, (_, i) => i + 1);

  const chay = () => {
    keKhai.mutate(ky, {
      onSuccess: (kq) => {
        toast.success(
          `Đã kê khai kỳ ${kq.nhanKy}: ${kq.purchase} hóa đơn mua vào, ${kq.sold} hóa đơn bán ra.`,
        );
        onClose();
        navigate(`/to-khai?${kyToQuery(ky)}`);
      },
      onError: (err) => toast.error(getErrorMessage(err, "Không kê khai được kỳ này.")),
    });
  };

  return (
    <Dialog open={open} onClose={keKhai.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Kê khai theo kỳ</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Mọi hóa đơn mua vào và bán ra có ngày lập trong kỳ sẽ được đưa vào bảng kê của kỳ này.
          Hóa đơn đã kê khai ở kỳ khác sẽ được chuyển sang kỳ vừa chọn.
        </Typography>

        <Stack direction="row" spacing={2}>
          <TextField
            select
            size="small"
            label="Loại kỳ"
            value={ky.kyLoai}
            disabled={keKhai.isPending}
            onChange={(e) => {
              const kyLoai = e.target.value as KyLoai;
              // Kẹp lại số kỳ khi đổi loại — đang chọn tháng 7 mà chuyển sang quý thì "quý 7" vô nghĩa.
              setKy((cu) => ({ ...cu, kyLoai, kySo: Math.min(cu.kySo, soKyToiDa(kyLoai)) }));
            }}
            sx={{ minWidth: 110 }}
          >
            <MenuItem value="thang">Tháng</MenuItem>
            <MenuItem value="quy">Quý</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label={ky.kyLoai === "thang" ? "Tháng" : "Quý"}
            value={ky.kySo}
            disabled={keKhai.isPending}
            onChange={(e) => setKy((cu) => ({ ...cu, kySo: Number(e.target.value) }))}
            sx={{ minWidth: 100 }}
          >
            {danhSachKySo.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Năm"
            value={ky.nam}
            disabled={keKhai.isPending}
            onChange={(e) => setKy((cu) => ({ ...cu, nam: Number(e.target.value) }))}
            sx={{ minWidth: 110 }}
          >
            {danhSachNam.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={keKhai.isPending} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={chay}
          disabled={keKhai.isPending}
          startIcon={keKhai.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ textTransform: "none" }}
        >
          Kê khai {nhanKy(ky)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

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
import Alert from "@mui/material/Alert";
import { toast } from "react-toastify";
import { useKeKhaiMutation, usePhuSongKyQuery } from "../api/toKhaiQueries";
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
  // Đọc lại mỗi khi đổi kỳ; chỉ gọi khi dialog đang mở.
  const phuSong = usePhuSongKyQuery(ky, open);

  const namHienTai = new Date().getFullYear();
  const danhSachNam = Array.from({ length: 6 }, (_, i) => namHienTai - i);
  const danhSachKySo = Array.from({ length: soKyToiDa(ky.kyLoai) }, (_, i) => i + 1);

  const chay = () => {
    keKhai.mutate(ky, {
      onSuccess: (kq) => {
        if (kq.khongRoKyGoc > 0) {
          // Không có ngày hóa đơn gốc thì không thể gán kỳ đúng. Chặn tờ đó thay vì tự lấy ngày
          // lập của hóa đơn điều chỉnh/thay thế, vì cách cũ có thể làm sai tờ khai.
          toast.warning(
            `${kq.khongRoKyGoc} hóa đơn thay thế/điều chỉnh chưa tra được hóa đơn gốc nên chưa được ` +
              `đưa vào bảng kê. Đồng bộ hoặc bổ sung hóa đơn gốc rồi kê khai lại.`,
          );
        }
        if (kq.daGo > 0) {
          // Gỡ khỏi kỳ là mất luôn cột "Kê khai"/"Ghi chú" của tờ đó ở kỳ này — không nói ra thì
          // kế toán tưởng mình chưa từng chỉnh.
          toast.info(
            `${kq.daGo} hóa đơn không còn thuộc kỳ ${kq.nhanKy} nên đã được gỡ khỏi bảng kê.`,
          );
        }
        if (kq.daGoKhongRoKyGoc > 0) {
          toast.info(
            `Đã gỡ ${kq.daGoKhongRoKyGoc} hóa đơn thay thế/điều chỉnh khỏi bảng kê cũ vì chưa ` +
              `xác định được hóa đơn gốc.`,
          );
        }
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
          Hóa đơn mua vào và bán ra thuộc kỳ sẽ được đưa vào bảng kê. Hóa đơn thay thế hoặc điều
          chỉnh được xếp theo ngày hóa đơn gốc; không xác định được gốc sẽ bị chặn để tránh sai kỳ.
        </Typography>

        {/*
          Cảnh báo kỳ chưa đồng bộ trọn. KHÔNG chặn cứng nút — có lúc kế toán cố ý kê khai phần
          đang có — nhưng phải nhìn thấy, vì tờ khai thiếu số trông y hệt tờ khai đủ số.
        */}
        {phuSong.data && !phuSong.data.daPhu && phuSong.data.canhBao && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {phuSong.data.canhBao}
          </Alert>
        )}

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
          {phuSong.data && !phuSong.data.daPhu ? "Vẫn kê khai" : "Kê khai"} {nhanKy(ky)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

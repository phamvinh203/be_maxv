import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import SaveRounded from "@mui/icons-material/SaveRounded";
import UndoRounded from "@mui/icons-material/UndoRounded";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import { getErrorMessage } from "../../../../lib/errors";
import {
  CANH_BAO_BIEU_THUE_LECH_CHUAN,
  useCauHinh,
  useKhoiPhucCauHinh,
  useLuuCauHinh,
  useTrangThaiCauHinh,
} from "../../api/cauHinhQueries";
import type { CauHinhMacDinh } from "../../types";
import CaLamViecSection from "./ca_lam_viec/CaLamViecSection";
import LuongBaoHiemSection from "./sections/LuongBaoHiemSection";
import ThoiGianSection from "./sections/ThoiGianSection";
import ThueSection from "./sections/ThueSection";
import XacNhanXoaDialog from "../XacNhanXoaDialog";

/**
 * Màn hình Cấu hình mặc định.
 *
 * Giữ một **bản nháp** tách khỏi cấu hình đã lưu: màn hình có hơn ba mươi ô số liên quan nhau
 * (tổng tỷ lệ bảo hiểm, ngưỡng lũy kế bậc thuế), lưu ngay từng ô sẽ để hệ thống rơi vào trạng
 * thái nửa vời trong lúc người dùng đang sửa dở. Sửa xong bấm một lần, và luôn hoàn tác được
 * về bản đã lưu.
 *
 * Nút **Khôi phục mặc định** cố ý KHÔNG chỉ nạp lại bản nháp: đó là thao tác **ghi** ở máy chủ
 * (`POST /settings/general/restore-default`), ghi đè toàn bộ tham số kể cả biểu thuế công ty tự
 * đặt và có ghi nhật ký. Vì không hoàn tác được nên bắt buộc hỏi xác nhận trước (FR-hrm-047).
 */
export default function CauHinhPanel() {
  const daLuu = useCauHinh();
  const { dangTai, loi, daCoDuLieu } = useTrangThaiCauHinh();
  const luuCauHinh = useLuuCauHinh();
  const khoiPhuc = useKhoiPhucCauHinh();

  const [nhap, setNhap] = useState<CauHinhMacDinh>(daLuu);
  const [dangLuu, setDangLuu] = useState(false);
  const [hoiKhoiPhuc, setHoiKhoiPhuc] = useState(false);

  useEffect(() => {
    // Đồng bộ lại bản nháp khi cấu hình đã lưu đổi (tải xong, vừa lưu, khôi phục mặc định,
    // hoặc đổi công ty) — cố ý bám theo state ngoài.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNhap(daLuu);
  }, [daLuu]);

  const coThayDoi = JSON.stringify(nhap) !== JSON.stringify(daLuu);

  const handleLuu = async () => {
    setDangLuu(true);
    try {
      const canhBao = await luuCauHinh(nhap);
      toast.success("Đã lưu cấu hình mặc định.");
      // Máy chủ cho lưu biểu thuế lệch chuẩn nhưng bắt buộc báo cho người dùng biết
      // (BR-hrm-083). `canhBao` vắng mặt là chuyện bình thường — không được coi là lỗi.
      if (canhBao === CANH_BAO_BIEU_THUE_LECH_CHUAN) {
        toast.warning(
          "Biểu thuế vừa lưu khác biểu chuẩn 7 bậc theo Điều 22 Luật Thuế TNCN. Hãy đối chiếu lại trước khi tính lương.",
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được cấu hình."));
    } finally {
      setDangLuu(false);
    }
  };

  const handleKhoiPhuc = async () => {
    setHoiKhoiPhuc(false);
    setDangLuu(true);
    try {
      await khoiPhuc();
      toast.success("Đã khôi phục bộ tham số mặc định theo quy định hiện hành.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không khôi phục được cấu hình mặc định."));
    } finally {
      setDangLuu(false);
    }
  };

  // Chưa tải xong thì `useCauHinh` trả bộ chuẩn để form có khung — nhưng phải khóa Lưu, nếu
  // không người dùng bấm sớm là ghi đè cấu hình thật bằng bộ chuẩn mà không hề sửa gì.
  const khoaGhi = dangLuu || dangTai || !daCoDuLieu;

  return (
    <Box>
      <Paper
        variant="outlined"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          mb: 2.5,
          p: 2,
          bgcolor: "background.paper",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Cấu hình mặc định
            </Typography>
            {dangTai && <Skeleton variant="rounded" width={120} height={22} />}
            {coThayDoi && !dangTai && (
              <Chip size="small" color="warning" label="Có thay đổi chưa lưu" sx={{ height: 22 }} />
            )}
          </Stack>

          <Stack direction="row" spacing={1.5}>
            <Button
              startIcon={<RestartAltRounded />}
              onClick={() => setHoiKhoiPhuc(true)}
              disabled={khoaGhi}
              sx={{ textTransform: "none" }}
            >
              Khôi phục mặc định
            </Button>
            <Button
              startIcon={<UndoRounded />}
              onClick={() => setNhap(daLuu)}
              disabled={!coThayDoi}
              sx={{ textTransform: "none" }}
            >
              Hoàn tác
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveRounded />}
              onClick={handleLuu}
              disabled={khoaGhi || !coThayDoi}
              sx={{ textTransform: "none" }}
            >
              Lưu cấu hình
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {loi && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          Không tải được cấu hình mặc định của công ty. Các ô bên dưới đang hiển thị bộ tham số
          chuẩn theo quy định, <strong>không phải</strong> số liệu đang lưu — hãy tải lại trang
          trước khi sửa.
        </Alert>
      )}

      <Stack spacing={2.5}>
        <ThoiGianSection values={nhap} onChange={setNhap} />
        <LuongBaoHiemSection values={nhap} onChange={setNhap} />
        <ThueSection values={nhap} onChange={setNhap} />
        <CaLamViecSection />
      </Stack>

      <XacNhanXoaDialog
        open={hoiKhoiPhuc}
        tieuDe="Khôi phục cấu hình mặc định"
        nhanXacNhan="Khôi phục"
        noiDung={
          <>
            Thao tác này ghi đè <strong>toàn bộ</strong> tham số của công ty về bộ mặc định chuẩn
            theo quy định hiện hành — <strong>kể cả biểu thuế TNCN mà công ty đã tự đặt</strong>,
            các hệ số tăng ca, tỷ lệ bảo hiểm và mức giảm trừ đã tùy chỉnh.
            <br />
            <br />
            Biểu thuế sẽ được nạp lại thành <strong>7 bậc chuẩn</strong> (Điều 22 Luật Thuế TNCN,
            trần 35%).
            <br />
            <br />
            <strong>Không hoàn tác được.</strong> Tiếp tục?
          </>
        }
        onClose={() => setHoiKhoiPhuc(false)}
        onXacNhan={() => void handleKhoiPhuc()}
      />
    </Box>
  );
}

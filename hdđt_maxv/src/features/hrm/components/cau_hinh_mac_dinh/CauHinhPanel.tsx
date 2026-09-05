import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import SaveRounded from "@mui/icons-material/SaveRounded";
import UndoRounded from "@mui/icons-material/UndoRounded";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import { getErrorMessage } from "../../../../lib/errors";
import { cauHinhMacDinhGoc, useCauHinh, useLuuCauHinh } from "../../mock/hooks/cauHinh";
import type { CauHinhMacDinh } from "../../types";
import CaLamViecSection from "./ca_lam_viec/CaLamViecSection";
import LuongBaoHiemSection from "./sections/LuongBaoHiemSection";
import ThoiGianSection from "./sections/ThoiGianSection";
import ThueSection from "./sections/ThueSection";

/**
 * Màn hình Cấu hình mặc định.
 *
 * Giữ một **bản nháp** tách khỏi cấu hình đã lưu: màn hình có hơn ba mươi ô số
 * liên quan nhau (tổng tỷ lệ bảo hiểm, mốc lũy kế bậc thuế), lưu ngay từng ô sẽ
 * để hệ thống rơi vào trạng thái nửa vời trong lúc người dùng đang sửa dở. Sửa
 * xong bấm một lần, và luôn hoàn tác được về bản đã lưu.
 */
export default function CauHinhPanel() {
  const daLuu = useCauHinh();
  const luuCauHinh = useLuuCauHinh();

  const [nhap, setNhap] = useState<CauHinhMacDinh>(daLuu);
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    // Đồng bộ lại bản nháp khi cấu hình đã lưu đổi (vừa lưu xong, hoặc rời màn
    // hình rồi quay lại) — cố ý bám theo state ngoài.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNhap(daLuu);
  }, [daLuu]);

  const coThayDoi = JSON.stringify(nhap) !== JSON.stringify(daLuu);

  const handleLuu = async () => {
    setDangLuu(true);
    try {
      await luuCauHinh(nhap);
      toast.success("Đã lưu cấu hình mặc định.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được cấu hình."));
    } finally {
      setDangLuu(false);
    }
  };

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
            {coThayDoi && (
              <Chip size="small" color="warning" label="Có thay đổi chưa lưu" sx={{ height: 22 }} />
            )}
          </Stack>

          <Stack direction="row" spacing={1.5}>
            <Button
              startIcon={<RestartAltRounded />}
              onClick={() => setNhap(cauHinhMacDinhGoc())}
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
              disabled={dangLuu || !coThayDoi}
              sx={{ textTransform: "none" }}
            >
              Lưu cấu hình
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Stack spacing={2.5}>
        <ThoiGianSection values={nhap} onChange={setNhap} />
        <LuongBaoHiemSection values={nhap} onChange={setNhap} />
        <ThueSection values={nhap} onChange={setNhap} />
        <CaLamViecSection />
      </Stack>
    </Box>
  );
}

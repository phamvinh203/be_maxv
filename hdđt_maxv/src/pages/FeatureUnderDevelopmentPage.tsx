import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import HomeRounded from "@mui/icons-material/HomeRounded";
import AppHeader from "../components/AppHeader";
import ManHinhDangPhatTrien from "../components/ManHinhDangPhatTrien";

interface Props {
  /** Tên module hiện trên trang, vd "HRM", "Kế toán". */
  ten: string;
  /** Một câu mô tả ngắn cho module — tuỳ chọn. */
  moTa?: string;
}

/**
 * Chặn cả module (mọi route con) sau nút HRM/Kế toán khi module đó chưa sẵn
 * sàng đưa lên production — xem cờ `MODULE_UNDER_DEVELOPMENT` trong
 * `config/featureFlags.ts`. Khác `ManHinhDangPhatTrien` dùng lẻ cho từng tab
 * bên trong 1 module đã mở: trang này thay cho toàn bộ layout module (không
 * có nav nội bộ), nên tự mang theo `AppHeader` + nút quay lại trang chủ.
 */
export default function FeatureUnderDevelopmentPage({ ten, moTa }: Props) {
  const navigate = useNavigate();

  return (
    <>
      <AppHeader />
      <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        <Stack spacing={3} sx={{ width: "100%", maxWidth: 640, alignItems: "center" }}>
          <ManHinhDangPhatTrien ten={ten} moTa={moTa} />
          <Button
            variant="outlined"
            startIcon={<HomeRounded />}
            sx={{ textTransform: "none" }}
            onClick={() => navigate("/hoa-don-dien-tu")}
          >
            Về trang chủ
          </Button>
        </Stack>
      </Box>
    </>
  );
}

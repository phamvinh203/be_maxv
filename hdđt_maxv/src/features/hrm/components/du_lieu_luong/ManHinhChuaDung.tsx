import { useLocation } from "react-router-dom";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ConstructionRounded from "@mui/icons-material/ConstructionRounded";
import { MAN_HINH_DU_LIEU_LUONG } from "./tabs";

/**
 * Chỗ giữ cho các màn hình dữ liệu lương chưa được mô tả nội dung.
 *
 * Hiện rõ "chưa dựng" thay vì để trang trắng — trang trắng đọc như một lỗi.
 */
export default function ManHinhChuaDung() {
  const { pathname } = useLocation();
  const manHinh = MAN_HINH_DU_LIEU_LUONG.find((mh) =>
    pathname.startsWith(`/hrm/du-lieu-luong/${mh.path}`),
  );

  return (
    <Paper variant="outlined" sx={{ p: 6 }}>
      <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center" }}>
        <ConstructionRounded sx={{ fontSize: 48, color: "text.disabled" }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {manHinh?.label ?? "Màn hình"} — chưa dựng
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
          {manHinh?.moTa}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ maxWidth: 520 }}>
          Mô tả nội dung và các cột cần có, tôi dựng tiếp.
        </Typography>
      </Stack>
    </Paper>
  );
}

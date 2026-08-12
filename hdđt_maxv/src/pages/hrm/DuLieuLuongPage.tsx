import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import DuLieuLuongNav from "../../features/hrm/components/du_lieu_luong/DuLieuLuongNav";

/** Layout của khu "Dữ liệu tính lương": tab con + màn hình con. */
export default function DuLieuLuongPage() {
  return (
    <Box>
      <DuLieuLuongNav />
      <Box sx={{ pt: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

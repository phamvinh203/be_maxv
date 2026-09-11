import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import DuLieuLuongNav from "../../../features/hrm/components/du_lieu_tinh_luong/DuLieuLuongNav";

/**
 * Layout của khu "Dữ liệu tính lương": tab con + màn hình con. Kỳ lương chọn ở góc phải thanh HRM
 * (`GocKyLuong`, provider bọc ở `HrmPage`); khóa sổ/trình duyệt/mở lại kỳ nằm ở màn Chốt kỳ lương.
 */
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

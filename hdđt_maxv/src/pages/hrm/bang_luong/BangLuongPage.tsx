import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import BangLuongNav from "../../../features/hrm/components/bang_luong/BangLuongNav";

/**
 * Layout của khu "Bảng lương": tab con + màn hình con. Kỳ lương chọn ở góc phải thanh HRM
 * (`GocKyLuong`) — dùng CHUNG `PayrollPeriodProvider` bọc ở `HrmPage` với mọi khu khác, nên đổi
 * tháng ở đó là bảng lương đổi theo.
 */
export default function BangLuongPage() {
  return (
    <Box>
      <BangLuongNav />
      <Box sx={{ pt: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

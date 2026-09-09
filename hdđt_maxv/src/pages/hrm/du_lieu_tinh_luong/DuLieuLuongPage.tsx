import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import DuLieuLuongNav from "../../../features/hrm/components/du_lieu_tinh_luong/DuLieuLuongNav";
import KyLuongSelector from "../../../features/hrm/components/du_lieu_tinh_luong/KyLuongSelector";
import { PayrollPeriodProvider } from "../../../features/hrm/components/du_lieu_tinh_luong/PayrollPeriodContext";

/** Layout của khu "Dữ liệu tính lương": tab con + quản lý kỳ lương + màn hình con. */
export default function DuLieuLuongPage() {
  return (
    <PayrollPeriodProvider>
      <Box>
        <KyLuongSelector />
        <DuLieuLuongNav />
        <Box sx={{ pt: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </PayrollPeriodProvider>
  );
}


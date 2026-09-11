import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import AppHeader from "../../components/AppHeader";
import HrmNav from "../../features/hrm/components/HrmNav";
import { PayrollPeriodProvider } from "../../features/hrm/components/du_lieu_tinh_luong/PayrollPeriodContext";
import GocKyLuong from "../../features/hrm/components/chot_ky_luong/GocKyLuong";

/**
 * Layout của khu HRM: header chung + thanh tab nổi cấp trên (góc phải là ô chọn tháng kỳ lương và
 * nút "Chốt kỳ lương") + khu con.
 *
 * `PayrollPeriodProvider` cũng bọc ở đây (không còn bọc riêng ở từng khu): ô tháng ở góc thanh HRM
 * là nơi chọn kỳ DUY NHẤT, đổi tháng là Dữ liệu tính lương, Bảng lương, Chốt kỳ lương cùng đổi.
 */
export default function HrmPage() {
  return (
    <PayrollPeriodProvider>
      <AppHeader />
      <Box sx={{ p: 3 }}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          sx={{ alignItems: { xs: "flex-start", lg: "center" }, justifyContent: "space-between" }}
        >
          {/* minWidth 0: cho thanh tab co lại và cuộn ngang, không đẩy góc kỳ lương ra ngoài. */}
          <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
            <HrmNav />
          </Box>
          <GocKyLuong />
        </Stack>

        <Box sx={{ pt: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </PayrollPeriodProvider>
  );
}

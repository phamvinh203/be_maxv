import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import AppHeader from "../../components/AppHeader";
import FullScreenLoader from "../../components/FullScreenLoader";
// NB-1: tái dùng ErrorBoundary sẵn có (không phụ thuộc gì riêng accounting, dùng chung được) thay
// vì viết mới ~20 dòng gần giống hệt.
import { AccountingErrorBoundary } from "../../components/Accounting/AccountingErrorBoundary";
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
          {/* NB-1: chặn crash trắng cả app khi 1 màn HRM lỗi lúc render.
              NB-2: 29 màn HRM nay là lazy chunk riêng (xem AppRouter.tsx) — Suspense ở SÁT
              Outlet để chỉ vùng nội dung này chờ tải, header/nav bên trên không bị ẩn theo. */}
          <AccountingErrorBoundary>
            <Suspense fallback={<FullScreenLoader />}>
              <Outlet />
            </Suspense>
          </AccountingErrorBoundary>
        </Box>
      </Box>
    </PayrollPeriodProvider>
  );
}

import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import BangLuongNav from "../../../features/hrm/components/bang_luong/BangLuongNav";
import KyLuongSelector from "../../../features/hrm/components/du_lieu_tinh_luong/KyLuongSelector";
import { PayrollPeriodProvider } from "../../../features/hrm/components/du_lieu_tinh_luong/PayrollPeriodContext";

/**
 * Layout của khu "Bảng lương": chọn kỳ + tab con + màn hình con.
 *
 * Bọc `PayrollPeriodProvider` RIÊNG (cùng component đã dùng ở `DuLieuLuongPage`, KHÔNG tự chế cơ
 * chế chọn kỳ mới) — cây state độc lập với khu "Dữ liệu tính lương" nhưng dùng CHUNG khóa
 * `localStorage` `hrm_selected_payroll_period_id`, nên kỳ đã chọn ở bên kia tự động là kỳ mặc
 * định ở đây khi mở màn lần đầu.
 */
export default function BangLuongPage() {
  return (
    <PayrollPeriodProvider>
      <Box>
        <KyLuongSelector />
        <BangLuongNav />
        <Box sx={{ pt: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </PayrollPeriodProvider>
  );
}

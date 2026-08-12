import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import AppHeader from "../../components/AppHeader";
import HrmNav from "../../features/hrm/components/HrmNav";
import HrmMockProvider from "../../features/hrm/mock/HrmMockProvider";

/**
 * Layout của khu HRM: header chung + thanh tab nổi cấp trên + khu con.
 *
 * `HrmMockProvider` bọc ở đây nên mọi khu con dùng chung một kho dữ liệu giả —
 * thêm nhân viên ở tab Danh mục thì số liệu ở tab Dashboard đổi theo ngay, và
 * chuyển tab qua lại không mất thay đổi vừa nhập. Dữ liệu chỉ tồn tại trong
 * phiên, tải lại trang là trở về bộ mẫu.
 */
export default function HrmPage() {
  return (
    <HrmMockProvider>
      <AppHeader />
      <Box sx={{ p: 3 }}>

        <HrmNav />

        <Box sx={{ pt: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </HrmMockProvider>
  );
}

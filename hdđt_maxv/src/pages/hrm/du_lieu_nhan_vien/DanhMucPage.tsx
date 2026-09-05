import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import DanhMucNav from "../../../features/hrm/components/DanhMucNav";

/** Layout của khu "Danh mục quản lý nhân viên": tab con + màn hình con. */
export default function DanhMucPage() {
  return (
    <Box>
      <DanhMucNav />
      <Box sx={{ pt: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

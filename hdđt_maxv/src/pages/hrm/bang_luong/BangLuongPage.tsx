import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import BangLuongNav from "../../../features/hrm/components/bang_luong/BangLuongNav";

/** Layout của khu "Bảng lương": tab con + màn hình con. */
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

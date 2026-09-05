import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import HoSoLuongNav from "../../../features/hrm/components/ho_so_luong/HoSoLuongNav";

/** Layout của khu "Hồ sơ lương": tab con + màn hình con. */
export default function HoSoLuongPage() {
  return (
    <Box>
      <HoSoLuongNav />
      <Box sx={{ pt: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

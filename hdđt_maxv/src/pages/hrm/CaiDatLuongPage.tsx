import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import CaiDatLuongNav from "../../features/hrm/components/cai_dat_luong/CaiDatLuongNav";

/** Layout của khu "Cài đặt lương": tab con + màn hình con. */
export default function CaiDatLuongPage() {
  return (
    <Box>
      <CaiDatLuongNav />
      <Box sx={{ pt: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

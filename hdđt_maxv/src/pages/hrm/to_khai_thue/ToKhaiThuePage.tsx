import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import ToKhaiThueNav from "../../../features/hrm/components/to_khai_thue/ToKhaiThueNav";

/** Layout của khu "Tờ khai thuế": tab con + màn hình con. */
export default function ToKhaiThuePage() {
  return (
    <Box>
      <ToKhaiThueNav />
      <Box sx={{ pt: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

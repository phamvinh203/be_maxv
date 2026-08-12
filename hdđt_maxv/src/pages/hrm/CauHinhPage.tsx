import { Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import CauHinhNav from "../../features/hrm/components/cau_hinh/CauHinhNav";

/** Layout của khu "Cấu hình mặc định": tab con + màn hình con. */
export default function CauHinhPage() {
  return (
    <Box>
      <CauHinhNav />
      <Box sx={{ pt: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

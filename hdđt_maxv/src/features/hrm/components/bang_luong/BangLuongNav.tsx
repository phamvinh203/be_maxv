import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { MAN_HINH_BANG_LUONG } from "./tabs";

/** Tab con bên trong khu "Bảng lương". */
export default function BangLuongNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const hienTai =
    MAN_HINH_BANG_LUONG.find((mh) =>
      pathname.startsWith(`/hrm/bang-luong/${mh.path}`),
    )?.path ?? false;

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Tabs
        value={hienTai}
        onChange={(_, value: string) => navigate(`/hrm/bang-luong/${value}`)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {MAN_HINH_BANG_LUONG.map((mh) => (
          <Tab
            key={mh.path}
            value={mh.path}
            label={mh.label}
            icon={<mh.icon fontSize="small" />}
            iconPosition="start"
            // `minHeight` giữ 52 như khu "Dữ liệu tính lương": mặc định của MUI
            // với tab có icon là 72, cao hơn hẳn và làm lệch bố cục hai khu.
            sx={{ textTransform: "none", fontWeight: 600, minHeight: 52 }}
          />
        ))}
      </Tabs>
    </Box>
  );
}

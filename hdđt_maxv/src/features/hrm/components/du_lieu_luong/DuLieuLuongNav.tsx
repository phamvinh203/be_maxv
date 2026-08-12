import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { MAN_HINH_DU_LIEU_LUONG } from "./tabs";

/** Tab con bên trong khu "Dữ liệu tính lương". */
export default function DuLieuLuongNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const hienTai =
    MAN_HINH_DU_LIEU_LUONG.find((mh) =>
      pathname.startsWith(`/hrm/du-lieu-luong/${mh.path}`),
    )?.path ?? false;

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Tabs
        value={hienTai}
        onChange={(_, value: string) => navigate(`/hrm/du-lieu-luong/${value}`)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {MAN_HINH_DU_LIEU_LUONG.map((mh) => (
          <Tab
            key={mh.path}
            value={mh.path}
            label={mh.label}
            sx={{ textTransform: "none", fontWeight: 600, minHeight: 52 }}
          />
        ))}
      </Tabs>
    </Box>
  );
}

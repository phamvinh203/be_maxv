import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import ListAltRounded from "@mui/icons-material/ListAltRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";

const MAN_HINH = [
  { path: "danh-muc-khoan", label: "Danh mục lương & phụ cấp", icon: <ListAltRounded /> },
  { path: "set-luong", label: "Set lương", icon: <TuneRounded /> },
];

/** Tab con bên trong khu "Cài đặt lương". */
export default function CaiDatLuongNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const hienTai =
    MAN_HINH.find((mh) => pathname.startsWith(`/hrm/cai-dat-luong/${mh.path}`))?.path ?? false;

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Tabs
        value={hienTai}
        onChange={(_, value: string) => navigate(`/hrm/cai-dat-luong/${value}`)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {MAN_HINH.map((mh) => (
          <Tab
            key={mh.path}
            value={mh.path}
            label={mh.label}
            icon={mh.icon}
            iconPosition="start"
            sx={{ textTransform: "none", fontWeight: 600, minHeight: 52 }}
          />
        ))}
      </Tabs>
    </Box>
  );
}

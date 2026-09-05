import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TuneRounded from "@mui/icons-material/TuneRounded";
import EventRounded from "@mui/icons-material/EventRounded";

const MAN_HINH = [
  { path: "thiet-lap-chung", label: "Thiết lập chung", icon: <TuneRounded /> },
  { path: "lich-ngay-le", label: "Lịch ngày lễ", icon: <EventRounded /> },
];

/** Tab con bên trong khu "Cấu hình mặc định". */
export default function CauHinhNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const hienTai =
    MAN_HINH.find((mh) => pathname.startsWith(`/hrm/cau-hinh/${mh.path}`))?.path ?? false;

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Tabs
        value={hienTai}
        onChange={(_, value: string) => navigate(`/hrm/cau-hinh/${value}`)}
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

import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { MAN_HINH_HO_SO_LUONG } from "./tabs";

/** Tab con bên trong khu "Hồ sơ lương". */
export default function HoSoLuongNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const hienTai =
    MAN_HINH_HO_SO_LUONG.find((mh) =>
      pathname.startsWith(`/hrm/ho-so-luong/${mh.path}`),
    )?.path ?? false;

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Tabs
        value={hienTai}
        onChange={(_, value: string) => navigate(`/hrm/ho-so-luong/${value}`)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {MAN_HINH_HO_SO_LUONG.map((mh) => (
          <Tab
            key={mh.path}
            value={mh.path}
            label={mh.label}
            icon={<mh.icon fontSize="small" />}
            iconPosition="start"
            // `minHeight` giữ 52 như các khu khác: mặc định của MUI với tab có
            // icon là 72, cao hơn hẳn và làm lệch bố cục giữa các khu.
            sx={{ textTransform: "none", fontWeight: 600, minHeight: 52 }}
          />
        ))}
      </Tabs>
    </Box>
  );
}

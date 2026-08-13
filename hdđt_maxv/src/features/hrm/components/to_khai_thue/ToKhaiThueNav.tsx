import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { MAN_HINH_TO_KHAI_THUE } from "./tabs";

/** Tab con bên trong khu "Tờ khai thuế". */
export default function ToKhaiThueNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const hienTai =
    MAN_HINH_TO_KHAI_THUE.find((mh) =>
      pathname.startsWith(`/hrm/to-khai-thue/${mh.path}`),
    )?.path ?? false;

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Tabs
        value={hienTai}
        onChange={(_, value: string) => navigate(`/hrm/to-khai-thue/${value}`)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {MAN_HINH_TO_KHAI_THUE.map((mh) => (
          <Tab
            key={mh.path}
            value={mh.path}
            label={mh.label}
            icon={<mh.icon fontSize="small" />}
            iconPosition="start"
            // `minHeight` giữ 52 như hai khu kia: mặc định của MUI với tab có
            // icon là 72, cao hơn hẳn và làm lệch bố cục giữa các khu.
            sx={{ textTransform: "none", fontWeight: 600, minHeight: 52 }}
          />
        ))}
      </Tabs>
    </Box>
  );
}

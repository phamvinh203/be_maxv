import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import NutHuongDan from "../huong_dan/NutHuongDan";
import { HUONG_DAN_DU_LIEU_TINH_LUONG } from "../huong_dan/noiDung";
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
    <Box sx={{ borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", gap: 2 }}>
      <Tabs
        sx={{ flex: 1, minWidth: 0 }}
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
            icon={<mh.icon fontSize="small" />}
            iconPosition="start"
            // `minHeight` giữ nguyên 52 như lúc chưa có icon: mặc định của MUI
            // với tab có icon là 72, cao hơn hẳn và làm lệch bố cục các khu khác.
            sx={{ textTransform: "none", fontWeight: 600, minHeight: 52 }}
          />
        ))}
      </Tabs>
      <NutHuongDan huongDan={HUONG_DAN_DU_LIEU_TINH_LUONG} />
    </Box>
  );
}

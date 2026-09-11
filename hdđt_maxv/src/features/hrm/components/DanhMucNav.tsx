import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import AccountTreeRounded from "@mui/icons-material/AccountTreeRounded";
import BadgeRounded from "@mui/icons-material/BadgeRounded";
import FamilyRestroomRounded from "@mui/icons-material/FamilyRestroomRounded";
import NutHuongDan from "./huong_dan/NutHuongDan";
import { HUONG_DAN_DU_LIEU_NHAN_VIEN } from "./huong_dan/noiDung";

const MAN_HINH = [
  { path: "phong-ban", label: "Phòng ban", icon: <AccountTreeRounded /> },
  { path: "nhan-vien", label: "Nhân viên", icon: <BadgeRounded /> },
  { path: "nguoi-phu-thuoc", label: "Người phụ thuộc", icon: <FamilyRestroomRounded /> },
];

/** Tab con bên trong khu "Danh mục quản lý nhân viên". */
export default function DanhMucNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const hienTai =
    MAN_HINH.find((mh) => pathname.startsWith(`/hrm/danh-muc/${mh.path}`))?.path ?? false;

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", gap: 2 }}>
      <Tabs
        sx={{ flex: 1, minWidth: 0 }}
        value={hienTai}
        onChange={(_, value: string) => navigate(`/hrm/danh-muc/${value}`)}
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
      <NutHuongDan huongDan={HUONG_DAN_DU_LIEU_NHAN_VIEN} />
    </Box>
  );
}

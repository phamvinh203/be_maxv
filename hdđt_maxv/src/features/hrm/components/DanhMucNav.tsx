import AccountTreeRounded from "@mui/icons-material/AccountTreeRounded";
import BadgeRounded from "@mui/icons-material/BadgeRounded";
import FamilyRestroomRounded from "@mui/icons-material/FamilyRestroomRounded";
import TabNavHrm from "./TabNavHrm";
import { HUONG_DAN_DU_LIEU_NHAN_VIEN } from "./huong_dan/noiDung";

const MAN_HINH = [
  { path: "phong-ban", label: "Phòng ban", icon: <AccountTreeRounded /> },
  { path: "nhan-vien", label: "Nhân viên", icon: <BadgeRounded /> },
  { path: "nguoi-phu-thuoc", label: "Người phụ thuộc", icon: <FamilyRestroomRounded /> },
];

/** Tab con bên trong khu "Danh mục quản lý nhân viên". */
export default function DanhMucNav() {
  return (
    <TabNavHrm base="/hrm/danh-muc" items={MAN_HINH} huongDan={HUONG_DAN_DU_LIEU_NHAN_VIEN} />
  );
}

import ListAltRounded from "@mui/icons-material/ListAltRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import TabNavHrm from "../TabNavHrm";
import { HUONG_DAN_CAI_DAT_LUONG } from "../huong_dan/noiDung";

const MAN_HINH = [
  { path: "danh-muc-khoan", label: "Danh mục lương & phụ cấp", icon: <ListAltRounded /> },
  { path: "set-luong", label: "Set lương", icon: <TuneRounded /> },
];

/** Tab con bên trong khu "Cài đặt lương". */
export default function CaiDatLuongNav() {
  return (
    <TabNavHrm base="/hrm/cai-dat-luong" items={MAN_HINH} huongDan={HUONG_DAN_CAI_DAT_LUONG} />
  );
}

import TuneRounded from "@mui/icons-material/TuneRounded";
import EventRounded from "@mui/icons-material/EventRounded";
import TabNavHrm from "../TabNavHrm";
import { HUONG_DAN_CAU_HINH_MAC_DINH } from "../huong_dan/noiDung";

const MAN_HINH = [
  { path: "thiet-lap-chung", label: "Thiết lập chung", icon: <TuneRounded /> },
  { path: "lich-ngay-le", label: "Lịch ngày lễ", icon: <EventRounded /> },
];

/** Tab con bên trong khu "Cấu hình mặc định". */
export default function CauHinhNav() {
  return <TabNavHrm base="/hrm/cau-hinh" items={MAN_HINH} huongDan={HUONG_DAN_CAU_HINH_MAC_DINH} />;
}

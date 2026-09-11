import TabNavHrm from "../TabNavHrm";
import { MAN_HINH_HO_SO_LUONG } from "./tabs";

/** Tab con bên trong khu "Hồ sơ lương". */
export default function HoSoLuongNav() {
  return (
    <TabNavHrm
      base="/hrm/ho-so-luong"
      items={MAN_HINH_HO_SO_LUONG.map((mh) => ({
        path: mh.path,
        label: mh.label,
        icon: <mh.icon fontSize="small" />,
      }))}
    />
  );
}

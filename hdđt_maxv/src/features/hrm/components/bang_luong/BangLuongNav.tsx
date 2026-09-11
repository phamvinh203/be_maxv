import TabNavHrm from "../TabNavHrm";
import { HUONG_DAN_BANG_LUONG } from "../huong_dan/noiDung";
import { MAN_HINH_BANG_LUONG } from "./tabs";

/** Tab con bên trong khu "Bảng lương". */
export default function BangLuongNav() {
  return (
    <TabNavHrm
      base="/hrm/bang-luong"
      items={MAN_HINH_BANG_LUONG.map((mh) => ({
        path: mh.path,
        label: mh.label,
        icon: <mh.icon fontSize="small" />,
      }))}
      huongDan={HUONG_DAN_BANG_LUONG}
    />
  );
}

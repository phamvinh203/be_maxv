import TabNavHrm from "../TabNavHrm";
import { MAN_HINH_TO_KHAI_THUE } from "./tabs";

/** Tab con bên trong khu "Tờ khai thuế". */
export default function ToKhaiThueNav() {
  return (
    <TabNavHrm
      base="/hrm/to-khai-thue"
      items={MAN_HINH_TO_KHAI_THUE.map((mh) => ({
        path: mh.path,
        label: mh.label,
        icon: <mh.icon fontSize="small" />,
      }))}
    />
  );
}

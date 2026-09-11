import type { ReactElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import NutHuongDan from "./huong_dan/NutHuongDan";
import type { HuongDan } from "./huong_dan/noiDung";

export interface MucTabHrm {
  path: string;
  label: string;
  icon: ReactElement;
}

interface Props {
  /** Prefix route tuyệt đối của khu, KHÔNG có dấu `/` cuối — vd `/hrm/bang-luong`. */
  base: string;
  items: MucTabHrm[];
  /** Bỏ qua thì không hiện nút "Hướng dẫn" (vd `HoSoLuongNav`, `ToKhaiThueNav`). */
  huongDan?: HuongDan;
}

/**
 * Thanh tab con dùng chung cho mọi khu của HRM.
 *
 * Sáu nav (`DanhMucNav`, `BangLuongNav`, `CaiDatLuongNav`, `CauHinhNav`, `HoSoLuongNav`,
 * `ToKhaiThueNav`) trước đây chép tay cùng một khung này — khác nhau đúng ba thứ: prefix path,
 * mảng màn hình, có/không `NutHuongDan` (RVW-A11, `docs/hrm/review-findings.md`).
 */
export default function TabNavHrm({ base, items, huongDan }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const hienTai = items.find((mh) => pathname.startsWith(`${base}/${mh.path}`))?.path ?? false;

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Tabs
        sx={{ flex: 1, minWidth: 0 }}
        value={hienTai}
        onChange={(_, value: string) => navigate(`${base}/${value}`)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {items.map((mh) => (
          <Tab
            key={mh.path}
            value={mh.path}
            label={mh.label}
            icon={mh.icon}
            iconPosition="start"
            // `minHeight` giữ 52 ở mọi khu: mặc định của MUI với tab có icon là 72, cao hơn hẳn
            // và làm lệch bố cục giữa các khu.
            sx={{ textTransform: "none", fontWeight: 600, minHeight: 52 }}
          />
        ))}
      </Tabs>
      {huongDan && <NutHuongDan huongDan={huongDan} />}
    </Box>
  );
}

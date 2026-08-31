import type { ReactNode } from "react";
import { OChiTieuTangGiam, OKeKhai } from "../components/OQuyetDinh";
import type { ToKhaiRow } from "../ky";

/**
 * Hàm dựng ô cho hai cột quyết định — cầu nối giữa `templates/{dauVao,dauRa}.ts` (file `.ts`, không
 * viết JSX được) và component thật trong `components/OQuyetDinh.tsx`.
 *
 * Cùng lối `ttTaiCell` bên `hddt/templates/cells.tsx`: template khai cột, file `.tsx` dựng ô.
 * File này CỐ Ý không định nghĩa component nào — chỉ hàm — để `react-refresh/only-export-components`
 * không phải chọn giữa hai loại export.
 */

export function oKeKhaiCell(row: ToKhaiRow): ReactNode {
  return <OKeKhai row={row} />;
}

export function oChiTieuTangGiamCell(row: ToKhaiRow): ReactNode {
  return <OChiTieuTangGiam row={row} />;
}

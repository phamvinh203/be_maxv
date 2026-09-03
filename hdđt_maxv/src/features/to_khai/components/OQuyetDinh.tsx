import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { toast } from "react-toastify";
import { useSuaQuyetDinhMutation } from "../api/toKhaiQueries";
import type { ChiTieuTangGiam, QuyetDinhKeKhai } from "../api/toKhai";
import type { ToKhaiRow } from "../ky";
import { getErrorMessage } from "../../../lib/errors";

/**
 * Hai ô chọn của bảng kê: "Kê khai/không kê khai" và "Chỉ tiêu tăng giảm".
 *
 * Đây là hai cột kế toán QUYẾT ĐỊNH, và cột "Kê khai" chính là công tắc bật/tắt hóa đơn khỏi lượt
 * tính tờ khai — nên sửa được ngay tại dòng, không phải mở màn khác.
 *
 * File này CHỈ export component (quy tắc `react-refresh/only-export-components`); phần hàm dựng ô
 * cho template nằm ở `templates/quyetDinhCell.tsx`.
 */

const SX_O = { fontSize: 13, width: "100%" } as const;

/** Lựa chọn cột "Chỉ tiêu tăng giảm" — có mục rỗng để kế toán xóa lựa chọn cũ. */
const CHI_TIEU_OPTIONS: { value: ChiTieuTangGiam; label: string }[] = [
  { value: "", label: "—" },
  { value: "tang", label: "Tăng" },
  { value: "giam", label: "Giảm" },
];

/** Gọi PATCH cho một dòng; lỗi thì báo toast chứ không nuốt — người dùng phải biết là chưa lưu. */
function useLuuQuyetDinh(row: ToKhaiRow) {
  const sua = useSuaQuyetDinhMutation();
  const luu = (quyetDinh: QuyetDinhKeKhai) =>
    sua.mutate(
      { chieu: row.chieu, id: row.id, quyetDinh },
      { onError: (err) => toast.error(getErrorMessage(err, "Không lưu được thay đổi.")) },
    );
  return { luu, dangLuu: sua.isPending };
}

export function OKeKhai({ row }: { row: ToKhaiRow }) {
  const { luu, dangLuu } = useLuuQuyetDinh(row);
  return (
    <Select
      variant="standard"
      value={row.keKhai ? "1" : "0"}
      disabled={dangLuu}
      onChange={(e) => luu({ keKhai: e.target.value === "1" })}
      sx={SX_O}
    >
      <MenuItem value="1">Kê khai</MenuItem>
      <MenuItem value="0">Không kê khai</MenuItem>
    </Select>
  );
}

export function OChiTieuTangGiam({ row }: { row: ToKhaiRow }) {
  const { luu, dangLuu } = useLuuQuyetDinh(row);
  return (
    <Select<ChiTieuTangGiam>
      variant="standard"
      value={row.chiTieuTangGiam}
      disabled={dangLuu}
      onChange={(e) => luu({ chiTieuTangGiam: e.target.value })}
      sx={SX_O}
    >
      {CHI_TIEU_OPTIONS.map((o) => (
        <MenuItem key={o.value || "rong"} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </Select>
  );
}

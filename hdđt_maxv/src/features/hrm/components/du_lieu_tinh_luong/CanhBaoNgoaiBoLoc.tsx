import Alert from "@mui/material/Alert";
import type { SxProps, Theme } from "@mui/material/styles";

interface Props {
  /** Số nhân viên có dữ liệu trên máy chủ nhưng đang bị 3 ô lọc hiện tại ẩn khỏi bảng. */
  soLuong: number;
  /** Tên dữ liệu, vd "KPI", "thưởng", "bù trừ". */
  module: string;
  sx?: SxProps<Theme>;
}

/**
 * Dòng cảnh báo dùng chung cho 7 Panel (RVW-711): dữ liệu {module} của nhân
 * viên ngoài phạm vi 3 ô lọc (nghỉ việc, đổi phòng ban, khác Loại HĐ...) vẫn
 * được máy chủ tính vào bảng lương dù biến mất khỏi MỌI bảng của màn này —
 * đổi bộ lọc là cách DUY NHẤT để thấy lại và kiểm tra/xóa.
 */
export default function CanhBaoNgoaiBoLoc({ soLuong, module, sx }: Props) {
  if (soLuong <= 0) return null;
  return (
    <Alert severity="warning" sx={sx}>
      Có <strong>{soLuong} nhân viên</strong> đã có dữ liệu {module} trong kỳ này nhưng đang bị bộ
      lọc hiện tại ẩn khỏi bảng (nghỉ việc, đổi phòng ban, hoặc khác Loại HĐ) — dữ liệu đó vẫn được
      tính vào bảng lương. Đổi phạm vi sang "Toàn công ty" hoặc nới bộ lọc để xem đầy đủ.
    </Alert>
  );
}

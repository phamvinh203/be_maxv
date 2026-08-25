import type { Theme } from "@mui/material/styles";

/**
 * Dòng kẻ dọc phân cách cột cho `<Table>` (cột cuối không kẻ, tránh trùng viền khung ngoài của
 * `TableContainer`). Dùng chung cho mọi bảng có nhiều cột (bảng Tổng quát/Chi tiết hóa đơn, bảng
 * Dịch vụ công) — trước đây mỗi bảng tự khai `sx` giống hệt nhau. `extraCellSx` để gộp thêm style
 * riêng của bảng đó vào ĐÚNG selector `"& td, & th"` (vd `whiteSpace: "nowrap"`) — cố ý nhận tham số
 * thay vì để nơi gọi tự ghép qua `sx` dạng mảng: MUI gộp mảng `sx` KHÔNG sâu tới từng selector lồng
 * nhau, ghép kiểu đó dễ vô tình đè mất `borderRight` thay vì cộng thêm `whiteSpace`.
 */
export function columnDividerSx(theme: Theme, extraCellSx: Record<string, unknown> = {}) {
  return {
    "& td, & th": { ...extraCellSx, borderRight: `1px solid ${theme.palette.divider}` },
    "& td:last-child, & th:last-child": { borderRight: "none" },
  };
}

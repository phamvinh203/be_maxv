/**
 * Kẹp `page` về khoảng hợp lệ khi tổng số dòng thay đổi (lọc/refetch trả ít dòng hơn) — tránh kẹt
 * ở trang trống. Tính lúc render (không setState); dùng chung nhiều bảng phân trang phía client.
 */
export function clampPage(page: number, count: number, rowsPerPage: number): number {
  return Math.min(page, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
}

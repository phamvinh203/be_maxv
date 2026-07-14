/**
 * Kẹp `page` về khoảng hợp lệ khi tổng số dòng thay đổi (refetch trả ít dòng hơn) — tránh kẹt
 * ở trang trống. Tính lúc render (không setState); 2 bảng Tổng quát/Chi tiết dùng chung.
 */
export function clampPage(page: number, count: number, rowsPerPage: number): number {
  return Math.min(page, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
}

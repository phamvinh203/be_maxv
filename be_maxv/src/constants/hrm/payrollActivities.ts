/**
 * Mã `hanhDong` ghi vào nhật ký hệ thống (`writeLog`) cho các thao tác trên kỳ lương.
 *
 * Một nguồn duy nhất cho CẢ bên ghi (`payrollPeriods.controller`, `payrollClosing.controller`) lẫn
 * bên đọc "Lịch sử hoạt động" (`payrollActivity.service`) — đổi chuỗi ở một bên mà không đổi bên kia
 * là dòng lịch sử lặng lẽ biến mất khỏi màn Chốt kỳ lương.
 */
export const HANH_DONG_KY_LUONG = {
  PERIOD_LOCKED: 'HRM_PAYROLL_PERIOD_LOCKED',
  PERIOD_REOPENED: 'HRM_PAYROLL_PERIOD_REOPENED',
  PERIOD_APPROVED: 'HRM_PAYROLL_PERIOD_APPROVED',
  MODULE_LOCKED: 'HRM_PAYROLL_MODULE_LOCKED',
  MODULE_UNLOCKED: 'HRM_PAYROLL_MODULE_UNLOCKED',
  MODULES_LOCKED_ALL: 'HRM_PAYROLL_MODULES_LOCKED_ALL',
  CALCULATED: 'HRM_PAYROLL_CALCULATED',
} as const;

export type HanhDongKyLuong = (typeof HANH_DONG_KY_LUONG)[keyof typeof HANH_DONG_KY_LUONG];

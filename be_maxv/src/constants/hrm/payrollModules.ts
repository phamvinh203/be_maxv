import type { PayrollModuleCode } from '../../generated/tenant';

/**
 * 12 bảng kê của màn "Chốt kỳ lương" (BR-dltl-030), đúng THỨ TỰ hiển thị trên màn.
 *
 * FE giữ bảng nhãn/màu/đường "Xem chi tiết" riêng (`features/hrm/components/chot_ky_luong/bangKe.ts`)
 * — máy chủ chỉ cần mã + nhãn để ghi nhật ký cho người đọc hiểu được.
 */
export const PAYROLL_MODULES: readonly { code: PayrollModuleCode; label: string }[] = [
  { code: 'ATTENDANCE', label: 'Chấm công' },
  { code: 'OVERTIME', label: 'Tăng ca' },
  { code: 'KPI', label: 'KPI' },
  { code: 'BONUS', label: 'Thưởng' },
  { code: 'ADJUSTMENT', label: 'Bù trừ' },
  { code: 'PIECEWORK', label: 'Sản lượng' },
  { code: 'COMMISSION', label: 'Lương phần trăm' },
  { code: 'OTHER_INCOME', label: 'Thu nhập ngoài bảng lương' },
  { code: 'DILIGENCE', label: 'Chuyên cần' },
  { code: 'TAX_DEDUCTION', label: 'Giảm trừ thuế TNCN' },
  { code: 'SALARY_PROFILE', label: 'Hồ sơ lương' },
  { code: 'SUPPORT_ALLOWANCE', label: 'Khoản hỗ trợ' },
];

/** Mã bảng kê cho Zod — tuple không rỗng. */
export const PAYROLL_MODULE_CODES = PAYROLL_MODULES.map((m) => m.code) as [
  PayrollModuleCode,
  ...PayrollModuleCode[],
];

/**
 * 8 bảng kê có dữ liệu RIÊNG của kỳ (`/payroll-data/*`) — chốt số thì máy chủ chặn ghi
 * (`assertPayrollModuleWritable`). 4 bảng kê còn lại là dữ liệu dùng chung nhiều kỳ (người phụ
 * thuộc, set lương, khoản hỗ trợ, thu nhập ngoài bảng lương): chốt số chỉ là xác nhận đã rà soát.
 */
const PERIOD_DATA_MODULES = [
  'ATTENDANCE',
  'OVERTIME',
  'KPI',
  'BONUS',
  'ADJUSTMENT',
  'PIECEWORK',
  'COMMISSION',
  'DILIGENCE',
] as const satisfies readonly PayrollModuleCode[];

export type PayrollPeriodDataModule = (typeof PERIOD_DATA_MODULES)[number];

export function laBangKeDuLieuKy(code: PayrollModuleCode): boolean {
  return (PERIOD_DATA_MODULES as readonly PayrollModuleCode[]).includes(code);
}

export function nhanBangKe(code: PayrollModuleCode): string {
  return PAYROLL_MODULES.find((m) => m.code === code)?.label ?? code;
}

import { z } from 'zod';
import { MESSAGES } from '../../../constants/messages';

export const SALARY_ITEM_CATEGORIES = [
  'FIXED_ALLOWANCE',
  'BENEFIT_ALLOWANCE',
  'DELIVERY_PIECEWORK',
  'COMMISSION_PERCENTAGE',
  'KPI_PERFORMANCE',
  'PERIODIC_BONUS',
  'ATTENDANCE_ALLOWANCE',
] as const;

export const SALARY_ITEM_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

/** Dùng chung cho create + update — hai schema chỉ khác nhau ở name/category/status bắt buộc hay không. */
const descriptionField = z
  .string()
  .trim()
  .max(500, 'Ghi chú tối đa 500 ký tự')
  .optional()
  .nullable();

const defaultRateField = z
  .number({ invalid_type_error: 'Tỷ lệ phải là số' })
  .min(0, 'Tỷ lệ không được âm')
  .max(100, 'Tỷ lệ tối đa 100%')
  .optional()
  .nullable();

export const createSalaryItemSchema = z.object({
  code: z
    .string()
    .trim()
    .max(20, 'Mã khoản lương tối đa 20 ký tự')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : undefined)),
  name: z
    .string({ required_error: MESSAGES.HRM.SALARY_ITEM_NAME_EMPTY })
    .trim()
    .min(1, MESSAGES.HRM.SALARY_ITEM_NAME_EMPTY)
    .max(200, 'Tên khoản lương tối đa 200 ký tự'),
  category: z.enum(SALARY_ITEM_CATEGORIES, {
    required_error: 'Loại khoản lương là bắt buộc',
  }),
  description: descriptionField,
  isSocialInsurance: z.boolean().default(false),
  isTaxable: z.boolean().default(true),
  defaultRate: defaultRateField,
});

export const updateSalaryItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, MESSAGES.HRM.SALARY_ITEM_NAME_EMPTY)
    .max(200, 'Tên khoản lương tối đa 200 ký tự')
    .optional(),
  category: z.enum(SALARY_ITEM_CATEGORIES).optional(),
  description: descriptionField,
  isSocialInsurance: z.boolean().optional(),
  isTaxable: z.boolean().optional(),
  defaultRate: defaultRateField,
  status: z.enum(SALARY_ITEM_STATUSES).optional(),
});

export const salaryItemListQuerySchema = z.object({
  q: z.string().trim().optional(),
  category: z.enum(SALARY_ITEM_CATEGORIES).optional(),
  status: z.enum(SALARY_ITEM_STATUSES).optional(),
});

export type CreateSalaryItemInput = z.infer<typeof createSalaryItemSchema>;
export type UpdateSalaryItemInput = z.infer<typeof updateSalaryItemSchema>;
export type SalaryItemListQuery = z.infer<typeof salaryItemListQuerySchema>;

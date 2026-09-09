import { z } from 'zod';
import { MESSAGES } from '../../../constants/messages';

export const TAX_TREATMENTS = ['TAXABLE', 'EXEMPT'] as const;
export const CALCULATION_METHODS = [
  'MONTHLY_FIXED',
  'ACTUAL_WORKDAYS',
  'HOURLY',
  'OUTPUT_BASED',
  'REVENUE_PERCENTAGE',
  'KPI_BASED',
  'MANUAL_ENTRY',
] as const;

export const salaryStructureItemSchema = z.object({
  salaryItemId: z.string({ required_error: 'Chưa chọn khoản lương' }).trim().min(1),
  taxTreatment: z.enum(TAX_TREATMENTS).default('TAXABLE'),
  isOvertimeBase: z.boolean().default(false),
  calculationMethod: z.enum(CALCULATION_METHODS).default('MONTHLY_FIXED'),
  defaultAmount: z
    .number({ invalid_type_error: 'Số tiền phải là số' })
    .min(0, 'Số tiền không được âm')
    .default(0),
});

export const saveSalaryStructureSchema = z
  .object({
    effectiveFrom: z
      .string({ required_error: 'Chưa chọn ngày bắt đầu hiệu lực' })
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày bắt đầu YYYY-MM-DD'),
    effectiveTo: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày kết thúc YYYY-MM-DD')
      .optional()
      .nullable(),
    note: z.string().trim().max(1000, 'Ghi chú tối đa 1000 ký tự').optional().nullable(),
    items: z
      .array(salaryStructureItemSchema)
      .min(1, MESSAGES.HRM.SALARY_STRUCTURE_EMPTY),
  })
  .superRefine((data, ctx) => {
    if (data.effectiveTo && data.effectiveTo < data.effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveTo'],
        message: MESSAGES.HRM.SALARY_STRUCTURE_DATES_INVALID,
      });
    }

    // Check duplicate salaryItemId in structure
    const seen = new Set<string>();
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (seen.has(item.salaryItemId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', i, 'salaryItemId'],
          message: MESSAGES.HRM.SALARY_DUPLICATE_ITEMS,
        });
      }
      seen.add(item.salaryItemId);
    }
  });

export type SaveSalaryStructureInput = z.infer<typeof saveSalaryStructureSchema>;
export type SalaryStructureItemInput = z.infer<typeof salaryStructureItemSchema>;

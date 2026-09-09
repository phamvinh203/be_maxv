import { z } from 'zod';
import { MESSAGES } from '../../../constants/messages';

export const employeeSalaryItemInputSchema = z.object({
  salaryItemId: z.string().trim().min(1, 'Mã ID khoản lương không được để trống'),
  amount: z
    .number({ invalid_type_error: 'Số tiền phải là số' })
    .min(0, 'Số tiền không được âm')
    .default(0),
});

export const setEmployeeSalarySchema = z
  .object({
    items: z.array(employeeSalaryItemInputSchema).optional(),
    khoan: z.record(z.string(), z.number()).optional(),
  })
  .transform((data) => {
    if (data.items && data.items.length > 0) {
      return { items: data.items };
    }
    if (data.khoan && Object.keys(data.khoan).length > 0) {
      const items = Object.entries(data.khoan).map(([salaryItemId, amount]) => ({
        salaryItemId,
        amount,
      }));
      return { items };
    }
    return { items: [] };
  })
  .superRefine((data, ctx) => {
    if (!data.items || data.items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: MESSAGES.HRM.SALARY_STRUCTURE_EMPTY,
      });
      return;
    }

    // Check duplicate salaryItemId (E-sal-011)
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

    // Check totalAmount > 0 (E-sal-008)
    const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);
    if (totalAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalAmount'],
        message: MESSAGES.HRM.SALARY_TOTAL_AMOUNT_INVALID,
      });
    }
  });

/** `true`/`false` gửi dạng boolean thật hoặc chuỗi `"true"`/`"false"` (query string) — dùng chung cho `hasSalary` và `daSet`, hai bí danh của cùng một cờ lọc. */
const optionalBooleanFlag = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .optional()
  .transform((v) => {
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    return undefined;
  });

export const employeeSalaryListQuerySchema = z
  .object({
    q: z.string().trim().optional(),
    departmentId: z.string().trim().optional(),
    ma_pb: z.string().trim().optional(),
    contractType: z.string().trim().optional(),
    loai_hd: z.string().trim().optional(),
    hasSalary: optionalBooleanFlag,
    daSet: optionalBooleanFlag,
  })
  .transform((data) => ({
    q: data.q,
    ma_pb: data.ma_pb || data.departmentId,
    loai_hd: data.loai_hd || data.contractType,
    hasSalary: data.daSet ?? data.hasSalary ?? true,
  }));

export const approveSalariesSchema = z.object({
  employeeIds: z.array(z.string().trim().min(1)).optional(),
});

export type SetEmployeeSalaryInput = z.infer<typeof setEmployeeSalarySchema>;
export type EmployeeSalaryListQuery = z.output<typeof employeeSalaryListQuerySchema>;
export type ApproveSalariesInput = z.infer<typeof approveSalariesSchema>;

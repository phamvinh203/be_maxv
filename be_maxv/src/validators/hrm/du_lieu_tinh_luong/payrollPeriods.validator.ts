import { z } from 'zod';

export const createPayrollPeriodSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  name: z.string().trim().min(1).max(100),
});

export type CreatePayrollPeriodInput = z.infer<typeof createPayrollPeriodSchema>;

export const updatePayrollPeriodSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
});

export type UpdatePayrollPeriodInput = z.infer<typeof updatePayrollPeriodSchema>;

export const listPayrollPeriodsQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  status: z
    .enum(['DRAFT', 'PENDING_REVIEW', 'LOCKED', 'APPROVED', 'PAID', 'ARCHIVED'])
    .optional(),
});

export type ListPayrollPeriodsQuery = z.infer<typeof listPayrollPeriodsQuerySchema>;

export const reopenPayrollPeriodSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(20, 'Lý do mở lại kỳ lương bắt buộc phải từ 20 ký tự trở lên (BR-dltl-001)'),
});

export type ReopenPayrollPeriodInput = z.infer<typeof reopenPayrollPeriodSchema>;

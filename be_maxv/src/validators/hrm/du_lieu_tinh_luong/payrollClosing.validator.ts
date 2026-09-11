import { z } from 'zod';
import { PAYROLL_MODULE_CODES } from '../../../constants/hrm/payrollModules';

export const payrollPeriodIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const payrollModuleParamsSchema = z.object({
  id: z.string().trim().min(1),
  module: z.enum(PAYROLL_MODULE_CODES),
});

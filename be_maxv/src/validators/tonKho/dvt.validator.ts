import { z } from 'zod';
import { optText } from '../shared/primitives';

/** Thân request tạo/sửa 1 đơn vị tính (dmdvt). */
export const dvtBodySchema = z.object({
  dvt: z.string().trim().min(1, 'Đvt không được để trống'),
  dvt2: optText,
  ten_dvt: z.string().trim().min(1, 'Tên đvt không được để trống'),
  ten_dvt2: optText,
  status: z.string().trim().default('1'),
});

/** Query danh sách (lọc theo dvt / ten_dvt). */
export const dvtListQuerySchema = z.object({
  dvt: z.string().trim().optional().default(''),
  ten_dvt: z.string().trim().optional().default(''),
});

/** Param :dvt. */
export const dvtParamSchema = z.object({
  dvt: z.string().min(1),
});

export type DvtBodyInput = z.infer<typeof dvtBodySchema>;
export type DvtListQuery = z.infer<typeof dvtListQuerySchema>;

import { z } from 'zod';
import { optText } from '../shared/primitives';

/** Thân request tạo/sửa 1 kho hàng (dmkho). */
export const khoBodySchema = z.object({
  ma_kho: z
    .string()
    .trim()
    .min(1, 'Mã kho không được để trống')
    .transform((s) => s.toUpperCase()),
  ma_dvcs: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length ? v : '001')),
  ten_kho: z.string().trim().min(1, 'Tên kho không được để trống'),
  ten_kho2: optText,
  dai_ly_yn: z.boolean().default(false),
  ma_nh: optText,
  ghi_chu: optText,
  status: z.string().trim().default('1'),
});

/** Query danh sách (lọc theo ma_kho / ten_kho / ma_dvcs). */
export const khoListQuerySchema = z.object({
  ma_kho: z.string().trim().optional().default(''),
  ten_kho: z.string().trim().optional().default(''),
  ma_dvcs: z.string().trim().optional().default(''),
});

/** Param :ma_kho. */
export const khoParamSchema = z.object({
  ma_kho: z.string().min(1),
});

export type KhoBodyInput = z.infer<typeof khoBodySchema>;
export type KhoListQuery = z.infer<typeof khoListQuerySchema>;

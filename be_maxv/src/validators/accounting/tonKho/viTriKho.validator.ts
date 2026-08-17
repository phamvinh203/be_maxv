import { z } from 'zod';
import { optText } from '../../shared/primitives';

/** Thân request tạo mới 1 vị trí kho (dmvitri). */
export const viTriBodySchema = z.object({
  ma_kho: z
    .string()
    .trim()
    .min(1, 'Mã kho không được để trống')
    .transform((s) => s.toUpperCase()),
  ma_vi_tri: z
    .string()
    .trim()
    .min(1, 'Mã vị trí không được để trống')
    .transform((s) => s.toUpperCase()),
  ten_vi_tri: z.string().trim().min(1, 'Tên vị trí không được để trống'),
  ten_vi_tri2: optText,
  status: z.string().trim().default('1'),
});

/** Thân request sửa: không đổi khóa (ma_kho, ma_vi_tri). */
export const viTriUpdateSchema = z.object({
  ten_vi_tri: z.string().trim().min(1, 'Tên vị trí không được để trống'),
  ten_vi_tri2: optText,
  status: z.string().trim().default('1'),
});

/** Query danh sách (lọc theo ma_kho / ma_vi_tri / ten_vi_tri). */
export const viTriListQuerySchema = z.object({
  ma_kho: z.string().trim().optional().default(''),
  ma_vi_tri: z.string().trim().optional().default(''),
  ten_vi_tri: z.string().trim().optional().default(''),
});

/** Param khóa ghép :ma_kho/:ma_vi_tri. */
export const viTriParamSchema = z.object({
  ma_kho: z.string().min(1),
  ma_vi_tri: z.string().min(1),
});

export type ViTriBodyInput = z.infer<typeof viTriBodySchema>;
export type ViTriUpdateInput = z.infer<typeof viTriUpdateSchema>;
export type ViTriListQuery = z.infer<typeof viTriListQuerySchema>;

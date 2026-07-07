import { z } from 'zod';
import { optText } from '../shared/primitives';

/** Thân request tạo mới 1 mã giao dịch (dmmagd). */
export const maGdBodySchema = z.object({
  ma_ct: z
    .string()
    .trim()
    .min(1, 'Mã chứng từ không được để trống')
    .transform((s) => s.toUpperCase()),
  loai_ct: optText,
  ma_gd: z
    .string()
    .trim()
    .min(1, 'Mã giao dịch không được để trống')
    .transform((s) => s.toUpperCase()),
  ten_gd: z.string().trim().min(1, 'Tên giao dịch không được để trống'),
  ten_gd2: optText,
  status: z.string().trim().default('1'),
});

/** Thân request sửa: không đổi khóa (ma_ct, ma_gd) — chỉ sửa phần còn lại. */
export const maGdUpdateSchema = z.object({
  loai_ct: optText,
  ten_gd: z.string().trim().min(1, 'Tên giao dịch không được để trống'),
  ten_gd2: optText,
  status: z.string().trim().default('1'),
});

/** Query danh sách (lọc theo ma_ct / ma_gd / ten_gd). */
export const maGdListQuerySchema = z.object({
  ma_ct: z.string().trim().optional().default(''),
  ma_gd: z.string().trim().optional().default(''),
  ten_gd: z.string().trim().optional().default(''),
});

/** Param khóa ghép :ma_ct/:ma_gd. */
export const maGdParamSchema = z.object({
  ma_ct: z.string().min(1),
  ma_gd: z.string().min(1),
});

export type MaGdBodyInput = z.infer<typeof maGdBodySchema>;
export type MaGdUpdateInput = z.infer<typeof maGdUpdateSchema>;
export type MaGdListQuery = z.infer<typeof maGdListQuerySchema>;

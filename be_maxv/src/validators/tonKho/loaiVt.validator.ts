import { z } from 'zod';
import { optText } from '../shared/primitives';

/** Thân request tạo mới 1 loại vật tư (dmloaivt). */
export const loaiVtBodySchema = z.object({
  ma_loai_vt: z
    .string()
    .trim()
    .min(1, 'Mã loại không được để trống')
    .transform((s) => s.toUpperCase()),
  ten_loai_vt: z.string().trim().min(1, 'Tên loại không được để trống'),
  ten_loai_vt2: optText,
  status: z.string().trim().default('1'),
});

/** Thân request sửa: không đổi khóa (ma_loai_vt). */
export const loaiVtUpdateSchema = z.object({
  ten_loai_vt: z.string().trim().min(1, 'Tên loại không được để trống'),
  ten_loai_vt2: optText,
  status: z.string().trim().default('1'),
});

/** Query danh sách (lọc theo ma_loai_vt / ten_loai_vt). */
export const loaiVtListQuerySchema = z.object({
  ma_loai_vt: z.string().trim().optional().default(''),
  ten_loai_vt: z.string().trim().optional().default(''),
});

/** Param :ma_loai_vt. */
export const loaiVtParamSchema = z.object({
  ma_loai_vt: z.string().min(1),
});

export type LoaiVtBodyInput = z.infer<typeof loaiVtBodySchema>;
export type LoaiVtUpdateInput = z.infer<typeof loaiVtUpdateSchema>;
export type LoaiVtListQuery = z.infer<typeof loaiVtListQuerySchema>;

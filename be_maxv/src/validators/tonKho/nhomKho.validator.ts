import { z } from 'zod';
import { optText } from '../shared/primitives';

/** Thân request tạo mới 1 nhóm kho (dmnhkho). */
export const nhomKhoBodySchema = z.object({
  ma_nh: z
    .string()
    .trim()
    .min(1, 'Mã nhóm không được để trống')
    .transform((s) => s.toUpperCase()),
  ten_nh: z.string().trim().min(1, 'Tên nhóm không được để trống'),
  ten_nh2: optText,
  status: z.string().trim().default('1'),
});

/** Thân request sửa: không đổi khóa (ma_nh). */
export const nhomKhoUpdateSchema = z.object({
  ten_nh: z.string().trim().min(1, 'Tên nhóm không được để trống'),
  ten_nh2: optText,
  status: z.string().trim().default('1'),
});

/** Query danh sách (lọc theo ma_nh / ten_nh). */
export const nhomKhoListQuerySchema = z.object({
  ma_nh: z.string().trim().optional().default(''),
  ten_nh: z.string().trim().optional().default(''),
});

/** Param :ma_nh. */
export const nhomKhoParamSchema = z.object({
  ma_nh: z.string().min(1),
});

export type NhomKhoBodyInput = z.infer<typeof nhomKhoBodySchema>;
export type NhomKhoUpdateInput = z.infer<typeof nhomKhoUpdateSchema>;
export type NhomKhoListQuery = z.infer<typeof nhomKhoListQuerySchema>;

import { z } from 'zod';
import { optText } from '../shared/primitives';

/** Thân request tạo mới 1 khách hàng (dmkh). */
export const khachHangBodySchema = z.object({
  ma_kh: z
    .string()
    .trim()
    .min(1, 'Mã khách hàng không được để trống')
    .transform((s) => s.toUpperCase()),
  ten_kh: z.string().trim().min(1, 'Tên khách hàng không được để trống'),
  ten_kh2: optText,
  dia_chi: optText,
  ma_so_thue: optText,
  status: z.string().trim().default('1'),
});

/** Thân request sửa: không đổi khóa (ma_kh). */
export const khachHangUpdateSchema = khachHangBodySchema.omit({ ma_kh: true });

/** Query danh sách (lọc theo ma_kh / ten_kh / dia_chi / ma_so_thue). */
export const khachHangListQuerySchema = z.object({
  ma_kh: z.string().trim().optional().default(''),
  ten_kh: z.string().trim().optional().default(''),
  dia_chi: z.string().trim().optional().default(''),
  ma_so_thue: z.string().trim().optional().default(''),
});

/** Param :ma_kh. */
export const khachHangParamSchema = z.object({
  ma_kh: z.string().min(1),
});

export type KhachHangBodyInput = z.infer<typeof khachHangBodySchema>;
export type KhachHangUpdateInput = z.infer<typeof khachHangUpdateSchema>;
export type KhachHangListQuery = z.infer<typeof khachHangListQuerySchema>;

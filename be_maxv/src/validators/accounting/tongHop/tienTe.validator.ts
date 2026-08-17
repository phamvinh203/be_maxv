import { z } from 'zod';
import { optText } from '../../shared/primitives';

/** Thân request tạo mới 1 ngoại tệ (dmnt). */
export const tienTeBodySchema = z.object({
  ma_nt: z
    .string()
    .trim()
    .min(1, 'Mã ngoại tệ không được để trống')
    .transform((s) => s.toUpperCase()),
  ten_nt: z.string().trim().min(1, 'Tên ngoại tệ không được để trống'),
  ten_nt2: optText,
  tk_pscl_no: optText,
  tk_pscl_co: optText,
  tk_dgcl_no: optText,
  tk_dgcl_co: optText,
  ra_ndec: z.coerce.number().int().default(0),
  ra_1: optText,
  ra_2: optText,
  ra_3: optText,
  ra_4: optText,
  ra_5: optText,
  ra_12: optText,
  ra_22: optText,
  ra_32: optText,
  ra_42: optText,
  ra_52: optText,
  status: z.string().trim().default('1'),
});

/** Thân request sửa: không đổi khóa (ma_nt). */
export const tienTeUpdateSchema = tienTeBodySchema.omit({ ma_nt: true });

/** Query danh sách (lọc theo ma_nt / ten_nt). */
export const tienTeListQuerySchema = z.object({
  ma_nt: z.string().trim().optional().default(''),
  ten_nt: z.string().trim().optional().default(''),
});

/** Param :ma_nt. */
export const tienTeParamSchema = z.object({
  ma_nt: z.string().min(1),
});

export type TienTeBodyInput = z.infer<typeof tienTeBodySchema>;
export type TienTeUpdateInput = z.infer<typeof tienTeUpdateSchema>;
export type TienTeListQuery = z.infer<typeof tienTeListQuerySchema>;

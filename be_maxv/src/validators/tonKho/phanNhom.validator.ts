import { z } from 'zod';
import { MESSAGES } from '../../constants/messages';
import { optText } from '../shared/primitives';

const loaiNh = z.coerce
  .number()
  .int()
  .refine((v) => [1, 2, 3].includes(v), MESSAGES.TON_KHO.NHOM_LOAI_INVALID);

/** Thân request tạo/sửa 1 nhóm hàng hóa (dmnhvt). */
export const phanNhomBodySchema = z.object({
  loai_nh: loaiNh,
  ma_nh: z
    .string()
    .trim()
    .min(1, 'Mã nhóm không được để trống')
    .transform((s) => s.toUpperCase()),
  ten_nh: z.string().trim().min(1, 'Tên nhóm không được để trống'),
  ten_nh2: optText,
  status: z.string().trim().default('1'),
});

/** Query danh sách (lọc theo loai_nh / ma_nh / ten_nh). */
export const phanNhomListQuerySchema = z.object({
  loai_nh: z.coerce.number().int().optional(),
  ma_nh: z.string().trim().optional().default(''),
  ten_nh: z.string().trim().optional().default(''),
});

/** Param :id = "loai_nh-ma_nh" (vd "1-HH"). */
export const phanNhomParamSchema = z.object({
  id: z.string().min(1),
});

export type PhanNhomBodyInput = z.infer<typeof phanNhomBodySchema>;
export type PhanNhomListQuery = z.infer<typeof phanNhomListQuerySchema>;

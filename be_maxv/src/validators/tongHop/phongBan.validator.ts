import { z } from 'zod';

/** '' | null | undefined -> null; có giá trị -> trim(). */
const optText = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => (v && v.length ? v : null));

/** Thân request tạo mới 1 phòng ban (dmpb). */
export const phongBanBodySchema = z.object({
  ma_pb: z
    .string()
    .trim()
    .min(1, 'Mã phòng ban không được để trống')
    .transform((s) => s.toUpperCase()),
  ten_pb: z.string().trim().min(1, 'Tên phòng ban không được để trống'),
  ten_pb2: optText,
  dia_chi: optText,
  dien_thoai: optText,
  ma_td1: optText,
  ten_tk: optText,
  ghi_chu: optText,
  status: z.string().trim().default('1'),
});

/** Thân request sửa: không đổi khóa (ma_pb). */
export const phongBanUpdateSchema = phongBanBodySchema.omit({ ma_pb: true });

/** Query danh sách (lọc theo ma_pb / ten_pb). */
export const phongBanListQuerySchema = z.object({
  ma_pb: z.string().trim().optional().default(''),
  ten_pb: z.string().trim().optional().default(''),
});

/** Param :ma_pb. */
export const phongBanParamSchema = z.object({
  ma_pb: z.string().min(1),
});

export type PhongBanBodyInput = z.infer<typeof phongBanBodySchema>;
export type PhongBanUpdateInput = z.infer<typeof phongBanUpdateSchema>;
export type PhongBanListQuery = z.infer<typeof phongBanListQuerySchema>;

import { z } from 'zod';
import { optText } from '../../shared/primitives';

/** '' | null | undefined -> null; else -> Int. (bac_tk) */
const optInt = z.preprocess(
  (v) => (v === '' || v == null ? null : Number(v)),
  z.number().int().nullable(),
);

/** Chuỗi cờ có mặc định (tk_sc='1', tk_cn='0'). */
const flag = (def: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length ? v : def));

/** Thân request tạo mới 1 tài khoản (dmtk). */
export const taiKhoanBodySchema = z.object({
  tk: z
    .string()
    .trim()
    .min(1, 'Tài khoản không được để trống')
    .transform((s) => s.toUpperCase()),
  ten_tk: z.string().trim().min(1, 'Tên tài khoản không được để trống'),
  ten_tk2: optText,
  ten_ngan: optText,
  ten_ngan2: optText,
  ma_nt: optText,
  tk_me: optText,
  bac_tk: optInt,
  tk_sc: flag('1'),
  tk_cn: flag('0'),
  nh_tk0: optText,
  nh_tk2: optText,
  loai_cl_no: optText,
  loai_cl_co: optText,
  status: z.string().trim().default('1'),
});

/** Thân request sửa: không đổi khóa (tk). */
export const taiKhoanUpdateSchema = taiKhoanBodySchema.omit({ tk: true });

/** Query danh sách (lọc theo tk / ten_tk / tk_me / ma_nt). */
export const taiKhoanListQuerySchema = z.object({
  tk: z.string().trim().optional().default(''),
  ten_tk: z.string().trim().optional().default(''),
  tk_me: z.string().trim().optional().default(''),
  ma_nt: z.string().trim().optional().default(''),
});

/** Param :tk. */
export const taiKhoanParamSchema = z.object({
  tk: z.string().min(1),
});

export type TaiKhoanBodyInput = z.infer<typeof taiKhoanBodySchema>;
export type TaiKhoanUpdateInput = z.infer<typeof taiKhoanUpdateSchema>;
export type TaiKhoanListQuery = z.infer<typeof taiKhoanListQuerySchema>;

import { z } from 'zod';
import { optText } from '../../shared/primitives';

/** Thân request tạo/sửa 1 mặt hàng (dmvt). Default khớp maxv_v1. */
export const hangHoaBodySchema = z.object({
  ma_vt: z
    .string()
    .trim()
    .min(1, 'Mã hàng không được để trống')
    .transform((s) => s.toUpperCase()),
  ten_vt: z.string().trim().min(1, 'Tên mặt hàng không được để trống'),
  ten_vt2: optText,
  dvt: z.string().trim().min(1, 'Đơn vị tính không được để trống'),
  dvt2: optText,
  he_so2: z.number().default(1),
  nhieu_dvt: z.boolean().default(false),
  vt_ton_kho: z.boolean().default(true),
  lo_yn: z.boolean().default(false),
  kk_yn: z.boolean().default(false),
  gia_ton: z.number().int().default(1),

  loai_vt: optText,
  nh_vt1: optText,
  nh_vt2: optText,
  nh_vt3: optText,

  ma_kho: optText,
  ma_vi_tri: optText,
  ma_thue: optText,
  ma_thue_nk: optText,

  tk_vt: optText,
  sua_tk_vt: z.boolean().default(false),
  tk_gv: optText,
  tk_dt: optText,
  tk_dtnb: optText,
  tk_tl: optText,
  tk_dl: optText,
  tk_spdd: optText,
  tk_cl_vt: optText,
  tk_ck: optText,
  tk_cpbh: optText,

  kieu_lo: z.number().int().default(1),
  cach_xuat: z.number().int().default(1),
  so_ngay_sp: z.number().int().default(0),
  so_ngay_bh: z.number().int().default(0),
  tao_lo: z.boolean().default(false),

  sl_min: z.number().default(0),
  sl_max: z.number().default(0),
  volume: z.number().default(0),
  dvtvolume: optText,
  weight: z.number().default(0),
  dvtweight: optText,

  ghi_chu: optText,
  status: z.string().trim().default('1'),
});

/** Query danh sách hàng hóa. */
export const hangHoaListQuerySchema = z.object({
  search: z.string().trim().optional().default(''),
  status: z.string().trim().optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

/** Param :ma_vt. */
export const maVtParamSchema = z.object({
  ma_vt: z.string().min(1),
});

/** Đổi / gộp mã hàng. */
export const doiMaSchema = z.object({
  ma_cu: z.string().trim().min(1),
  ma_moi: z.string().trim().min(1),
});

export type HangHoaBodyInput = z.infer<typeof hangHoaBodySchema>;
export type HangHoaListQuery = z.infer<typeof hangHoaListQuerySchema>;
export type DoiMaInput = z.infer<typeof doiMaSchema>;

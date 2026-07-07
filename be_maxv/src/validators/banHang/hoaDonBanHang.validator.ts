import { z } from 'zod';
import { optText } from '../shared/primitives';

/** Số thực, thiếu -> 0. */
const num = z.coerce.number().default(0);
/** Số nguyên, thiếu -> 0. */
const int0 = z.coerce.number().int().default(0);
/** Ngày: '' -> null, else Date. */
const optDate = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.coerce.date().nullable(),
);
/** Cờ boolean: chỉ true | 1 | '1' mới là true. */
const boolFlag = z.preprocess(
  (v) => v === true || v === 1 || v === '1',
  z.boolean(),
);

/** 1 dòng chi tiết (d81). */
export const hoaDonChiTietSchema = z.object({
  ma_vt: z.string().trim().min(1, 'Mã hàng không được để trống'),
  dvt: optText,
  dvt2: optText,
  he_so2: num,
  km_yn: int0,
  ma_kho: optText,
  ma_vi_tri: optText,
  ma_lo: optText,

  so_luong: num,
  gia_nt2: num,
  tien_nt2: num,
  tl_ck: num,
  ck_nt: num,

  ma_thue: optText,
  thue_suat: num,
  thue_nt: num,

  tk_dt: optText,
  tk_ck: optText,
  tk_thue: optText,

  px_gia_dd: boolFlag,
  gia_nt: num,
  tien_nt: num,

  tk_vt: optText,
  tk_gv: optText,
  tk_cpbh: optText,

  gia2: num,
  tien2: num,
  ck: num,
  thue: num,
  gia: num,
  tien: num,

  so_luong2: num,
  so_luong2_nl: num,
  so_luong_giao: num,
  so_luong_hh: num,
  ty_le_hh: num,

  gia_khay_nt: num,
  gia_khay: num,
  tien_khay_nt: num,
  tien_khay: num,
  tien_no_nt: num,
  tien_no: num,

  ma_dhb: optText,
  ma_du_an: optText,
  ma_pb: optText,
});

/** Thân request tạo/sửa 1 hóa đơn bán hàng (header m81 + mảng chi tiết d81). */
export const hoaDonBodySchema = z.object({
  ma_dvcs: optText,
  ngay_ct: optDate,
  ngay_lct: optDate,
  so_ct: z.string().trim().min(1, 'Số chứng từ không được để trống'),
  so_seri: optText,

  ma_kh: z.string().trim().min(1, 'Mã khách hàng không được để trống'),
  ma_kh2: optText,
  ong_ba: optText,
  dien_giai: optText,

  tk: optText,
  ma_nt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length ? v.toUpperCase() : 'VND')),
  ty_gia: z.coerce.number().default(1),
  ma_gd: optText,
  loai_ct: optText,

  ma_nvbh: optText,
  ma_tt: optText,
  ma_ht_tt: optText,
  tk_thue_no: optText,
  tk_thue_co: optText,

  t_so_luong: num,
  t_tien_nt2: num,
  t_tien2: num,
  t_ck_nt: num,
  t_ck: num,
  t_thue_nt: num,
  t_thue: num,
  t_tt_nt: num,
  t_tt: num,

  // Không ràng buộc enum vì chưa xác định chắc chắn toàn bộ tập giá trị hợp lệ đang
  // dùng trong nghiệp vụ hiện tại — chỉ giới hạn độ dài để tránh giá trị bất thường.
  status: z.string().trim().max(10).default('2'),

  chi_tiet: z.array(hoaDonChiTietSchema).default([]),
});

/** Query danh sách. */
export const hoaDonListQuerySchema = z.object({
  ma_dvcs: z.string().trim().optional().default(''),
  ngay_ct: z.string().trim().optional().default(''),
  so_ct: z.string().trim().optional().default(''),
  ma_kh: z.string().trim().optional().default(''),
  ten_kh: z.string().trim().optional().default(''),
  dien_giai: z.string().trim().optional().default(''),
  trang_thai: z.string().trim().optional().default(''),
  nguoi_lap: z.string().trim().optional().default(''),
});

/** Param :stt_rec. */
export const hoaDonParamSchema = z.object({
  stt_rec: z.string().min(1),
});

export type HoaDonChiTietInput = z.infer<typeof hoaDonChiTietSchema>;
export type HoaDonBodyInput = z.infer<typeof hoaDonBodySchema>;
export type HoaDonListQuery = z.infer<typeof hoaDonListQuerySchema>;

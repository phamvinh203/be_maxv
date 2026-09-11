import { z } from 'zod';
import { optTextMax } from '../../shared/primitives';

/** Số thực hữu hạn (không Infinity), thiếu -> 0. */
const num = z.coerce.number().finite().default(0);
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

/**
 * 1 dòng chi tiết (d81) — CHỈ input thô. Các cột tiền (tien_nt2, ck_nt, thue_nt, tiền khay, tiền tính nợ
 * và bản quy đổi gia2/tien2/ck/thue/...) server tự tính (`tinhTienHoaDon.ts`); client gửi kèm thì bị
 * bỏ (zod `object` lọc khóa lạ). `thue_suat` client gửi cũng không dùng — lấy theo `ma_thue` từ danh mục.
 */
export const hoaDonChiTietSchema = z.object({
  ma_vt: z
    .string()
    .trim()
    .min(1, 'Mã hàng không được để trống')
    .max(32, 'Mã hàng tối đa 32 ký tự'),
  dvt: optTextMax(24),
  dvt2: optTextMax(24),
  he_so2: num,
  km_yn: int0,
  ma_kho: optTextMax(24),
  ma_vi_tri: optTextMax(24),
  ma_lo: optTextMax(24),

  so_luong: num,
  gia_nt2: num,
  tl_ck: num,

  ma_thue: optTextMax(24),

  tk_dt: optTextMax(24),
  tk_ck: optTextMax(24),
  tk_thue: optTextMax(24),

  px_gia_dd: boolFlag,
  gia_nt: num,
  tien_nt: num,

  tk_vt: optTextMax(24),
  tk_gv: optTextMax(24),
  tk_cpbh: optTextMax(24),

  gia: num,
  tien: num,

  so_luong2: num,
  so_luong2_nl: num,
  so_luong_giao: num,
  so_luong_hh: num,
  ty_le_hh: num,

  gia_khay_nt: num,

  ma_dhb: optTextMax(32),
  ma_du_an: optTextMax(24),
  ma_pb: optTextMax(24),
});

/** Trạng thái chứng từ: 2 = Lập chứng từ, 1 = Đã ghi sổ, 0 = Hủy (khớp FE `HoaDonList`). */
export const TRANG_THAI_DA_GHI_SO = '1';

/** Số dòng chi tiết tối đa của MỘT hóa đơn. */
export const HOA_DON_DONG_TOI_DA = 500;

/**
 * Thân request tạo/sửa 1 hóa đơn bán hàng (header m81 + mảng chi tiết d81). Trần độ dài chuỗi = độ dài cột
 * `VarChar` tương ứng (vbsec 2026-09-10).
 */
export const hoaDonBodySchema = z.object({
  ma_dvcs: optTextMax(24),
  ngay_ct: optDate,
  ngay_lct: optDate,
  so_ct: z
    .string()
    .trim()
    .min(1, 'Số chứng từ không được để trống')
    .max(24, 'Số chứng từ tối đa 24 ký tự'),
  so_seri: optTextMax(64),

  ma_kh: z
    .string()
    .trim()
    .min(1, 'Mã khách hàng không được để trống')
    .max(24, 'Mã khách hàng tối đa 24 ký tự'),
  ma_kh2: optTextMax(24),
  ong_ba: optTextMax(254),
  dien_giai: optTextMax(512),

  tk: optTextMax(24),
  ma_nt: z
    .string()
    .trim()
    .max(24, 'Mã ngoại tệ tối đa 24 ký tự')
    .optional()
    .transform((v) => (v && v.length ? v.toUpperCase() : 'VND')),
  // Nhân vào mọi số quy đổi (`tinhTienHoaDon.ts`) — 0/âm là ra hóa đơn tiền 0/âm.
  ty_gia: z.coerce.number().positive('Tỷ giá phải lớn hơn 0').default(1),
  ma_gd: optTextMax(24),
  loai_ct: optTextMax(8),

  ma_nvbh: optTextMax(24),
  ma_tt: optTextMax(24),
  ma_ht_tt: optTextMax(24),
  tk_thue_no: optTextMax(24),
  tk_thue_co: optTextMax(24),

  // Tổng tiền/thuế/thanh toán KHÔNG nhận từ client — server cộng từ các dòng (`tinhTienHoaDon.ts`).

  // Client chỉ được lập (2) hoặc hủy (0). "Đã ghi sổ" (1) là kết quả của bước ghi sổ, không phải lựa
  // chọn trên form — FE cũng không cho chọn khi tạo/sửa.
  status: z
    .enum(['2', '0'], {
      errorMap: () => ({
        message: 'Trạng thái chỉ được là Lập chứng từ hoặc Hủy.',
      }),
    })
    .default('2'),

  // Trần số dòng: một request không được ghi hàng chục nghìn dòng d81 trong một transaction.
  chi_tiet: z
    .array(hoaDonChiTietSchema)
    .max(HOA_DON_DONG_TOI_DA, `Tối đa ${HOA_DON_DONG_TOI_DA} dòng mỗi hóa đơn`)
    .default([]),
});

/** Số dòng tối đa mỗi trang danh sách — khớp lựa chọn lớn nhất của FE (25/50/100). */
export const HOA_DON_TRANG_TOI_DA = 100;

/** Query danh sách — CÓ phân trang (vbsec 2026-09-10: trước đây trả toàn bộ bảng m81). */
export const hoaDonListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(HOA_DON_TRANG_TOI_DA)
    .default(25),
  /** Ô tìm chung của màn danh sách: số CT / mã khách / tên khách / diễn giải. */
  q: z.string().trim().max(100).optional().default(''),
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

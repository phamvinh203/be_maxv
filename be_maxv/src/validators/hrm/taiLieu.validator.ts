import { z } from 'zod';
import { ngayTuyChon, optText } from '../shared/primitives';

/** Text tùy chọn có giới hạn độ dài — chặn ở đây để tràn cột trả 400 thay vì 500 từ Postgres. */
function optTextMax(max: number, nhan: string) {
  return optText.refine(
    (v) => v === null || v.length <= max,
    `${nhan} tối đa ${max} ký tự`,
  );
}

const thanTaiLieu = z.object({
  ma_nv: z
    .string()
    .trim()
    .min(1, 'Mã nhân viên không được để trống')
    .max(24, 'Mã nhân viên tối đa 24 ký tự')
    .transform((s) => s.toUpperCase()),

  /**
   * Loại giấy tờ — chữ tự do, KHÔNG ép enum (xem ghi chú ở model `hrm_tai_lieu`).
   * Bắt buộc vì đây là thứ duy nhất phân biệt các dòng trong hồ sơ; thiếu thì bảng chỉ còn
   * một cột số hiệu trống nghĩa.
   */
  loai: z
    .string()
    .trim()
    .min(1, 'Chưa chọn loại tài liệu')
    .max(50, 'Loại tài liệu tối đa 50 ký tự'),

  // Tùy chọn: có loại giấy tờ không mang số hiệu (vd sơ yếu lý lịch).
  so_hieu: optTextMax(64, 'Số hiệu'),
  ngay_cap: ngayTuyChon,
  noi_cap: optTextMax(254, 'Nơi cấp'),
  ghi_chu: optTextMax(512, 'Ghi chú'),
});

/** Thân request tạo mới 1 tài liệu (hrm_tai_lieu). */
export const taiLieuBodySchema = thanTaiLieu;

/**
 * Thân request sửa: KHÔNG đổi `ma_nv` — chuyển giấy tờ sang hồ sơ người khác là thao tác khác
 * hẳn về nghiệp vụ (và dễ là thao tác nhầm), bắt xóa rồi tạo lại cho có vết.
 */
export const taiLieuUpdateSchema = thanTaiLieu.omit({ ma_nv: true });

/** Query danh sách (lọc theo nhân viên / loại giấy tờ). */
export const taiLieuListQuerySchema = z.object({
  // In hoa cho khớp cách ghi — xem ghi chú cùng loại ở nhanVien.validator.
  ma_nv: z
    .string()
    .trim()
    .optional()
    .default('')
    .transform((s) => s.toUpperCase()),
  loai: z.string().trim().optional().default(''),
});

/** Param :id. */
export const taiLieuParamSchema = z.object({
  id: z.string().min(1),
});

export type TaiLieuBodyInput = z.infer<typeof taiLieuBodySchema>;
export type TaiLieuUpdateInput = z.infer<typeof taiLieuUpdateSchema>;
export type TaiLieuListQuery = z.infer<typeof taiLieuListQuerySchema>;

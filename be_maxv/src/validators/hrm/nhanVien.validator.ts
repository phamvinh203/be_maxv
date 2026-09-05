import { z } from 'zod';
import {
  ngayISO,
  ngayTuyChon,
  optEmail,
  optMst,
  optText,
} from '../shared/primitives';

/** Text tùy chọn có giới hạn độ dài — chặn ở đây để tràn cột trả 400 thay vì 500 từ Postgres. */
function optTextMax(max: number, nhan: string) {
  return optText.refine(
    (v) => v === null || v.length <= max,
    `${nhan} tối đa ${max} ký tự`,
  );
}

/**
 * Mã nhân viên khi TẠO MỚI: bỏ trống thì service tự sinh (`NV0001`, `NV0002`…), có nhập thì
 * tôn trọng mã người dùng đặt. Để server cấp mã vì hai người tạo cùng lúc trên hai máy không
 * thể tự thỏa thuận với nhau mã kế tiếp là gì.
 */
const maNvTuyChon = optTextMax(24, 'Mã nhân viên').transform((v) =>
  v ? v.toUpperCase() : null,
);

export const GIOI_TINH = ['nam', 'nu', 'khac'] as const;
export const LOAI_HOP_DONG = ['thu_viec', 'hdld', 'hdvc'] as const;
export const KIEU_LUONG = ['gross', 'net'] as const;

/**
 * Ngày hiệu lực tới phải sau ngày vào làm. Tách thành hàm dùng chung cho cả schema tạo và sửa:
 * để rời rạc thì thêm luật mới ở một bên là bên kia lặng lẽ mất luật, không có lỗi biên dịch.
 */
function soatNgayHopDong(
  v: { ngay_vao_lam: Date; ngay_hieu_luc_toi: Date | null },
  ctx: z.RefinementCtx,
): void {
  if (v.ngay_hieu_luc_toi && v.ngay_hieu_luc_toi <= v.ngay_vao_lam) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ngay_hieu_luc_toi'],
      message: 'Ngày hiệu lực tới phải sau ngày vào làm',
    });
  }
}

const thanNhanVien = z.object({
  ma_nv: maNvTuyChon,
  ho_ten: z
    .string()
    .trim()
    .min(1, 'Họ và tên không được để trống')
    .max(254, 'Họ và tên tối đa 254 ký tự'),

  // Thông tin cá nhân
  ngay_sinh: ngayTuyChon,
  so_cccd: optTextMax(20, 'Số CCCD'),
  mst_ca_nhan: optMst,
  dien_thoai: optTextMax(20, 'Số điện thoại'),
  email: optEmail,
  dia_chi: optTextMax(500, 'Địa chỉ'),
  gioi_tinh: z.enum(GIOI_TINH).nullable().optional().default(null),

  // Công việc
  ma_pb: optTextMax(24, 'Mã phòng ban').transform((v) =>
    v ? v.toUpperCase() : null,
  ),
  chuc_vu: optTextMax(100, 'Chức vụ'),
  cap_bac: optTextMax(64, 'Cấp bậc'),

  // Hợp đồng & lương — 4 trường bắt buộc theo yêu cầu nghiệp vụ
  so_hop_dong: z
    .string()
    .trim()
    .min(1, 'Số hợp đồng không được để trống')
    .max(100, 'Số hợp đồng tối đa 100 ký tự'),
  loai_hop_dong: z.enum(LOAI_HOP_DONG),
  kieu_luong: z.enum(KIEU_LUONG),
  ngay_vao_lam: ngayISO,
  ngay_hieu_luc_toi: ngayTuyChon,

  // Chế độ — bỏ trống thì theo mặc định dưới đây (khớp mô tả cột trong file nhập Excel)
  bhxh: z.boolean().default(true),
  tncn: z.boolean().default(true),
  mien_cham_cong: z.boolean().default(false),
  cong_doan: z.boolean().default(true),

  // Tài khoản ngân hàng
  so_tai_khoan: optTextMax(30, 'Số tài khoản'),
  ten_tai_khoan: optTextMax(100, 'Tên tài khoản'),
  // Danh sách ngân hàng là gợi ý ở FE, có lựa chọn "Khác" -> lưu chữ tự do, không ép enum.
  ngan_hang: optTextMax(128, 'Ngân hàng'),

  ghi_chu: optTextMax(2000, 'Ghi chú'),
  status: z.enum(['0', '1']).default('1'),
});

/** Thân request tạo mới 1 nhân viên (hrm_nhan_vien). */
export const nhanVienBodySchema = thanNhanVien.superRefine(soatNgayHopDong);

/**
 * Thân request sửa: KHÔNG đổi khóa (ma_nv) — giống danh mục phòng ban.
 * `hrm_nguoi_phu_thuoc.ma_nv` và các bảng lương sau này đều trỏ vào mã này; đổi mã tại chỗ
 * là mời dữ liệu mồ côi. Muốn đổi mã thì xóa rồi tạo lại.
 *
 * Bốn cờ chế độ ở đây là BẮT BUỘC (khác lúc tạo, có mặc định): PUT thay TOÀN BỘ bản ghi, mà
 * schema không phân biệt được "không gửi" với "gửi true" — thiếu trường là âm thầm bật lại
 * BHXH/công đoàn cho người đã cố ý tắt. Bắt buộc thì client gửi thiếu sẽ nhận 400 rõ ràng.
 */
export const nhanVienUpdateSchema = thanNhanVien
  .omit({ ma_nv: true })
  .extend({
    bhxh: z.boolean(),
    tncn: z.boolean(),
    mien_cham_cong: z.boolean(),
    cong_doan: z.boolean(),
  })
  .superRefine(soatNgayHopDong);

/** Query danh sách (lọc theo mã / họ tên / phòng ban / trạng thái). */
export const nhanVienListQuerySchema = z.object({
  ma_nv: z.string().trim().optional().default(''),
  ho_ten: z.string().trim().optional().default(''),
  // In hoa cho khớp cách ghi (ma_pb luôn được in hoa lúc lưu) — không thì `?ma_pb=pb01`
  // trả về danh sách rỗng thay vì báo sai, người dùng tưởng phòng ban không có ai.
  ma_pb: z
    .string()
    .trim()
    .optional()
    .default('')
    .transform((s) => s.toUpperCase()),
  status: z.enum(['0', '1']).optional(),
});

/** Param :ma_nv. */
export const nhanVienParamSchema = z.object({
  ma_nv: z.string().min(1),
});

export type NhanVienBodyInput = z.infer<typeof nhanVienBodySchema>;
export type NhanVienUpdateInput = z.infer<typeof nhanVienUpdateSchema>;
export type NhanVienListQuery = z.infer<typeof nhanVienListQuerySchema>;

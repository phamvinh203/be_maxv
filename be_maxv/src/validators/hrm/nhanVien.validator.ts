import { z } from 'zod';
import { optText } from '../shared/primitives';

/**
 * Ngày dạng `YYYY-MM-DD` -> Date (UTC 00:00).
 *
 * Ép đúng chuẩn ISO thay vì `z.coerce.date()`: coerce nuốt cả `"15/01/2026"` (ra ngày sai)
 * lẫn số nguyên, mà đây là ngày dùng để tính hợp đồng/lương nên sai một ngày là sai bảng
 * lương. Ghim UTC để ngày không tự lùi/tiến theo múi giờ máy chủ (cột là `@db.Date`).
 */
const ngayISO = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD')
  .transform((s, ctx) => {
    const d = new Date(`${s}T00:00:00Z`);
    // Đối chiếu ngược chuỗi: `new Date("2026-02-30")` KHÔNG trả Invalid Date mà tự trôi sang
    // 2026-03-02 — chỉ kiểm NaN thì ngày gõ nhầm sẽ lặng lẽ lưu thành ngày khác.
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Ngày không có thật: ${s}`,
      });
      return z.NEVER;
    }
    return d;
  });

/** Ngày tùy chọn: '' | null | thiếu -> null. */
const ngayTuyChon = z
  .union([ngayISO, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

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

/** Thân request tạo mới 1 nhân viên (hrm_nhan_vien). */
export const nhanVienBodySchema = z
  .object({
    ma_nv: maNvTuyChon,
    ho_ten: z
      .string()
      .trim()
      .min(1, 'Họ và tên không được để trống')
      .max(254, 'Họ và tên tối đa 254 ký tự'),

    // Thông tin cá nhân
    ngay_sinh: ngayTuyChon,
    so_cccd: optTextMax(20, 'Số CCCD'),
    mst_ca_nhan: optTextMax(20, 'MST cá nhân'),
    dien_thoai: optTextMax(20, 'Số điện thoại'),
    email: optTextMax(254, 'Email'),
    dia_chi: optTextMax(500, 'Địa chỉ'),
    gioi_tinh: z.enum(GIOI_TINH).nullable().optional().default(null),

    // Công việc
    ma_pb: optTextMax(24, 'Mã phòng ban').transform((v) =>
      v ? v.toUpperCase() : null,
    ),
    chuc_vu: optTextMax(100, 'Chức vụ'),

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
  })
  .superRefine((v, ctx) => {
    if (v.ngay_hieu_luc_toi && v.ngay_hieu_luc_toi <= v.ngay_vao_lam) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ngay_hieu_luc_toi'],
        message: 'Ngày hiệu lực tới phải sau ngày vào làm',
      });
    }
  });

/**
 * Thân request sửa: KHÔNG đổi khóa (ma_nv) — giống danh mục phòng ban.
 * `hrm_nguoi_phu_thuoc.ma_nv` và các bảng lương sau này đều trỏ vào mã này; đổi mã tại chỗ
 * là mời dữ liệu mồ côi. Muốn đổi mã thì xóa rồi tạo lại.
 */
export const nhanVienUpdateSchema = nhanVienBodySchema
  .innerType()
  .omit({ ma_nv: true })
  .superRefine((v, ctx) => {
    if (v.ngay_hieu_luc_toi && v.ngay_hieu_luc_toi <= v.ngay_vao_lam) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ngay_hieu_luc_toi'],
        message: 'Ngày hiệu lực tới phải sau ngày vào làm',
      });
    }
  });

/** Query danh sách (lọc theo mã / họ tên / phòng ban / trạng thái). */
export const nhanVienListQuerySchema = z.object({
  ma_nv: z.string().trim().optional().default(''),
  ho_ten: z.string().trim().optional().default(''),
  ma_pb: z.string().trim().optional().default(''),
  status: z.enum(['0', '1']).optional(),
});

/** Param :ma_nv. */
export const nhanVienParamSchema = z.object({
  ma_nv: z.string().min(1),
});

export type NhanVienBodyInput = z.infer<typeof nhanVienBodySchema>;
export type NhanVienUpdateInput = z.infer<typeof nhanVienUpdateSchema>;
export type NhanVienListQuery = z.infer<typeof nhanVienListQuerySchema>;

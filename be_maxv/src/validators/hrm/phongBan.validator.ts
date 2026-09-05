import { z } from 'zod';
import { optText } from '../shared/primitives';

/**
 * Mã phòng ban cha: '' -> null; có giá trị -> in hoa (khớp cách chuẩn hóa ma_pb).
 * Giới hạn 24 ký tự y như `ma_pb`: hiện chuỗi quá dài chỉ trượt vì `findFirst` không khớp
 * (ra 404 "phòng ban cha không tồn tại"), nhưng đó là chặn NHỜ MAY — đổi thứ tự kiểm tra hay
 * thêm một đường ghi khác là nó đi thẳng vào cột VarChar(24) và Postgres trả 500.
 */
const maPbMe = optText
  .refine(
    (v) => v === null || v.length <= 24,
    'Mã phòng ban cha tối đa 24 ký tự',
  )
  .transform((v) => (v ? v.toUpperCase() : null));

/** Ghi chú — chặn ở tầng validator để tràn cột VarChar(512) trả 400 thay vì 500 từ Postgres. */
const ghiChu = optText.refine(
  (v) => v === null || v.length <= 512,
  'Ghi chú tối đa 512 ký tự',
);

/**
 * Mã phòng ban khi TẠO MỚI: bỏ trống thì service tự sinh theo cây (`PB01`, `PB01.01`…),
 * có nhập thì tôn trọng mã người dùng đặt. Để server cấp mã vì hai người tạo cùng lúc trên
 * hai máy không thể tự thỏa thuận với nhau mã kế tiếp là gì.
 */
const maPbTuyChon = optText
  .refine((v) => v === null || v.length <= 24, 'Mã phòng ban tối đa 24 ký tự')
  .transform((v) => (v ? v.toUpperCase() : null));

/** Thân request tạo mới 1 phòng ban HRM (hrm_phong_ban). */
export const phongBanBodySchema = z.object({
  ma_pb: maPbTuyChon,
  ten_pb: z
    .string()
    .trim()
    .min(1, 'Tên phòng ban không được để trống')
    .max(254, 'Tên phòng ban tối đa 254 ký tự'),
  ma_pb_me: maPbMe,
  ghi_chu: ghiChu,
  status: z.enum(['0', '1']).default('1'),
});

/**
 * Thân request sửa: KHÔNG đổi khóa (ma_pb) — giống danh mục phòng ban bên Tổng hợp.
 * Lý do riêng của HRM: `hrm_nhan_vien.ma_pb` và `hrm_phong_ban.ma_pb_me` tham chiếu mềm
 * (không FK cứng, xem schema.prisma), đổi mã tại chỗ sẽ bỏ lại nhân viên + phòng ban con
 * trỏ vào mã không còn tồn tại. Muốn đổi mã thì xóa rồi tạo lại.
 */
export const phongBanUpdateSchema = phongBanBodySchema.omit({ ma_pb: true });

/** Query danh sách (lọc theo ma_pb / ten_pb / status). */
export const phongBanListQuerySchema = z.object({
  ma_pb: z.string().trim().optional().default(''),
  ten_pb: z.string().trim().optional().default(''),
  status: z.enum(['0', '1']).optional(),
});

/** Param :ma_pb. */
export const phongBanParamSchema = z.object({
  ma_pb: z.string().min(1),
});

export type PhongBanBodyInput = z.infer<typeof phongBanBodySchema>;
export type PhongBanUpdateInput = z.infer<typeof phongBanUpdateSchema>;
export type PhongBanListQuery = z.infer<typeof phongBanListQuerySchema>;

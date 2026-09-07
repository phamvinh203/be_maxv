import { z } from 'zod';
import { ngayISO, ngayTuyChon, optText } from '../shared/primitives';

/** Text tùy chọn có giới hạn độ dài — chặn ở đây để tràn cột trả 400 thay vì 500 từ Postgres. */
function optTextMax(max: number, nhan: string) {
  return optText.refine(
    (v) => v === null || v.length <= max,
    `${nhan} tối đa ${max} ký tự`,
  );
}

/** Tiền: không âm, tối đa 2 số lẻ (khớp cột Decimal(18,2)). */
function tien(nhan: string) {
  return (
    z
      .number({ invalid_type_error: `${nhan} phải là số` })
      .min(0, `${nhan} không được âm`)
      .max(999_999_999_999.99, `${nhan} vượt giới hạn cho phép`)
      // Cột là Decimal(18,2): quá 2 số lẻ thì Postgres LÀM TRÒN im lặng, mà response chỉ trả
      // `{ id }` nên người dùng chỉ phát hiện số mình gõ bị đổi khi tải lại trang.
      .multipleOf(0.01, `${nhan} chỉ được tối đa 2 số lẻ`)
      .default(0)
  );
}

const thanHopDong = z.object({
  ma_nv: z
    .string()
    .trim()
    .min(1, 'Mã nhân viên không được để trống')
    .max(24, 'Mã nhân viên tối đa 24 ký tự')
    .transform((s) => s.toUpperCase()),

  so_hd: z
    .string()
    .trim()
    .min(1, 'Số hợp đồng không được để trống')
    .max(100, 'Số hợp đồng tối đa 100 ký tự'),

  /**
   * Loại hợp đồng — chữ tự do (xem ghi chú ở model `hrm_hop_dong`), giữ đủ 5 giá trị của FE
   * chứ không gom về 3 như bản sao trên nhân viên.
   */
  loai_hd: z
    .string()
    .trim()
    .min(1, 'Chưa chọn loại hợp đồng')
    .max(24, 'Loại hợp đồng tối đa 24 ký tự'),

  kieu_luong: z.enum(['gross', 'net']),

  luong_chinh: tien('Lương chính'),
  luong_bhxh: tien('Lương đóng BHXH'),

  ngay_bat_dau: ngayISO,
  ngay_ket_thuc: ngayTuyChon,

  trich_bhxh: z.boolean().default(true),
  tinh_tncn: z.boolean().default(true),
  ghi_chu: optTextMax(512, 'Ghi chú'),
});

/**
 * Ngày kết thúc phải sau ngày bắt đầu. Tách hàm dùng chung cho mọi schema ở file này —
 * để rời rạc thì thêm luật ở một chỗ là chỗ kia lặng lẽ thiếu luật, không có lỗi biên dịch.
 */
function soatNgay(
  v: { ngay_bat_dau: Date; ngay_ket_thuc: Date | null },
  ctx: z.RefinementCtx,
): void {
  if (v.ngay_ket_thuc && v.ngay_ket_thuc <= v.ngay_bat_dau) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ngay_ket_thuc'],
      message: 'Ngày kết thúc phải sau ngày bắt đầu',
    });
  }
}

/** Thân request tạo mới 1 hợp đồng. */
export const hopDongBodySchema = thanHopDong.superRefine(soatNgay);

/** Thân request sửa: KHÔNG đổi `ma_nv` (chuyển hợp đồng sang người khác → xóa rồi tạo lại). */
export const hopDongUpdateSchema = thanHopDong
  .omit({ ma_nv: true })
  .superRefine(soatNgay);

/**
 * Thân request "đổi hợp đồng": chốt hợp đồng đang hiệu lực vào `ngay_chot` rồi ký hợp đồng mới.
 * Gộp một request vì hai việc phải cùng thành công — chốt xong mà tạo mới hỏng thì nhân viên
 * mất hợp đồng.
 */
export const doiHopDongBodySchema = thanHopDong
  .extend({
    /**
     * Ngày chốt hợp đồng cũ. Bỏ trống khi nhân viên chưa có hợp đồng nào (không có gì để chốt).
     * Service sẽ chặn nếu thực sự có hợp đồng đang hiệu lực mà không truyền ngày này.
     */
    ngay_chot: ngayTuyChon,
  })
  .superRefine((v, ctx) => {
    soatNgay(v, ctx);
    // Hợp đồng mới bắt đầu trước/đúng ngày chốt sẽ có HAI hợp đồng cùng hiệu lực, lúc đó luật
    // "hợp đồng hiện hành" trả về cái nào cũng đúng như nhau — tức là không xác định được.
    if (v.ngay_chot && v.ngay_bat_dau <= v.ngay_chot) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ngay_bat_dau'],
        message: 'Hợp đồng mới phải bắt đầu sau ngày chốt hợp đồng cũ',
      });
    }
  });

/** Query danh sách (lọc theo nhân viên). */
export const hopDongListQuerySchema = z.object({
  // In hoa cho khớp cách ghi — xem ghi chú cùng loại ở nhanVien.validator.
  ma_nv: z
    .string()
    .trim()
    .optional()
    .default('')
    .transform((s) => s.toUpperCase()),
});

/** Param :id. */
export const hopDongParamSchema = z.object({
  id: z.string().min(1),
});

export type HopDongBodyInput = z.infer<typeof hopDongBodySchema>;
export type HopDongUpdateInput = z.infer<typeof hopDongUpdateSchema>;
export type DoiHopDongBodyInput = z.infer<typeof doiHopDongBodySchema>;
export type HopDongListQuery = z.infer<typeof hopDongListQuerySchema>;

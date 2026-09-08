import { z } from 'zod';
import { ngayISO, ngayTuyChon, optText } from '../../shared/primitives';

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
 * Ngày kết thúc KHÔNG được TRƯỚC ngày bắt đầu — `[SỬA THEO QĐ #6]` BR-hrm-026.
 *
 * Bằng nhau là HỢP LỆ: hợp đồng đúng một ngày (khoán một ngày, thời vụ ngắn) là chuyện có
 * thật, chặn là chặn oan. Kéo theo: luật chống chồng lấn phải dùng khoảng ngày ĐÓNG CẢ HAI
 * ĐẦU (xem `khoangGiaoNhau` ở hopDong.service), nếu không hợp đồng một ngày có độ dài bằng
 * không và không bao giờ bị bắt chồng lấn.
 *
 * Tách hàm dùng chung cho mọi schema ở file này — để rời rạc thì thêm luật ở một chỗ là chỗ
 * kia lặng lẽ thiếu luật, không có lỗi biên dịch.
 */
function soatNgay(
  v: { ngay_bat_dau: Date; ngay_ket_thuc: Date | null },
  ctx: z.RefinementCtx,
): void {
  if (v.ngay_ket_thuc && v.ngay_ket_thuc < v.ngay_bat_dau) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ngay_ket_thuc'],
      message: 'Ngày kết thúc không được trước ngày bắt đầu',
    });
  }
}

/**
 * Ràng buộc lương — `[MỚI — QĐ #5]` BR-hrm-057 (E-hrm-056) và BR-hrm-058 (E-hrm-057).
 *
 * Đặt ở validator chứ không ở service để áp được cho CẢ BA đường ghi qua đúng một khai báo
 * (`thanHopDong` là gốc chung của tạo / sửa / đổi), và để lỗi về đúng dạng 400 kèm `fieldErrors`
 * — giao diện gắn được câu lỗi vào đúng ô nhập.
 *
 * `luong_chinh` mang mặc định 0 nên "không gửi" và "gửi 0" là cùng một thứ ở đây; cả hai đều
 * phải bị chặn: số 0 chảy thẳng vào bảng lương thành "trả 0 đồng" mà không có gì báo.
 */
function soatLuong(
  v: { luong_chinh: number; luong_bhxh: number; trich_bhxh: boolean },
  ctx: z.RefinementCtx,
): void {
  if (!(v.luong_chinh > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['luong_chinh'],
      message: 'Lương chính phải lớn hơn 0.',
    });
  }
  if (v.trich_bhxh && !(v.luong_bhxh > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['luong_bhxh'],
      message:
        'Đã bật trích BHXH nên lương đóng BHXH phải lớn hơn 0. Nếu không đóng BHXH, hãy tắt ô Trích BHXH.',
    });
  }
}

/** Mọi luật chéo áp cho MỌI đường ghi hợp đồng. Thêm luật mới thì thêm vào đây, không rải ra. */
function soatChungHopDong(
  v: {
    ngay_bat_dau: Date;
    ngay_ket_thuc: Date | null;
    luong_chinh: number;
    luong_bhxh: number;
    trich_bhxh: boolean;
  },
  ctx: z.RefinementCtx,
): void {
  soatNgay(v, ctx);
  soatLuong(v, ctx);
}

/** Thân request tạo mới 1 hợp đồng. */
export const hopDongBodySchema = thanHopDong.superRefine(soatChungHopDong);

/** Thân request sửa: KHÔNG đổi `ma_nv` (chuyển hợp đồng sang người khác → xóa rồi tạo lại). */
export const hopDongUpdateSchema = thanHopDong
  .omit({ ma_nv: true })
  .superRefine(soatChungHopDong);

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

    /**
     * Loại hợp đồng CẦN CHỐT — `[MỚI — QĐ #1]` BR-hrm-053. **Bắt buộc.**
     *
     * Từ khi hai hợp đồng khác nhóm được phép chạy song song, "hợp đồng đang hiệu lực" là khái
     * niệm mơ hồ: đổi hợp đồng lao động chính lại vô tình chốt mất hợp đồng khoán đang chạy, và
     * không có gì báo. Máy chủ gom nhãn này về nhóm nghiệp vụ rồi chỉ tìm hợp đồng trong đúng
     * nhóm đó. Thiếu trường -> 400 (E-hrm-006).
     */
    loai_hd_can_chot: z
      .string()
      .trim()
      .min(1, 'Chưa chọn loại hợp đồng cần chốt')
      .max(24, 'Loại hợp đồng cần chốt tối đa 24 ký tự'),
  })
  .superRefine((v, ctx) => {
    soatChungHopDong(v, ctx);
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

/**
 * Query danh sách — `ma_nv` là **BẮT BUỘC** `[SỬA THEO QĐ #8]` (FR-hrm-013).
 *
 * Trước đây trường này tùy chọn, và gọi trần trả về TOÀN BỘ hợp đồng của mọi nhân viên trong
 * công ty: mở màn hồ sơ một người là tải bảng lương cả công ty về trình duyệt (BUG-HRM-25).
 * Đây là rò rỉ qua thiết kế, không phải chuyện hiệu năng. Thiếu tham số -> 400 (E-hrm-006).
 */
export const hopDongListQuerySchema = z.object({
  // In hoa cho khớp cách ghi — xem ghi chú cùng loại ở nhanVien.validator.
  ma_nv: z
    .string()
    .trim()
    .min(1, 'Phải chọn nhân viên để xem lịch sử hợp đồng')
    .max(24, 'Mã nhân viên tối đa 24 ký tự')
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

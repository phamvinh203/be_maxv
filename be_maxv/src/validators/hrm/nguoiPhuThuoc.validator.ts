import { z } from 'zod';
import { optText } from '../shared/primitives';

/** Text tùy chọn có giới hạn độ dài — chặn ở đây để tràn cột trả 400 thay vì 500 từ Postgres. */
function optTextMax(max: number, nhan: string) {
  return optText.refine(
    (v) => v === null || v.length <= max,
    `${nhan} tối đa ${max} ký tự`,
  );
}

/**
 * Ngày sinh người phụ thuộc lưu dạng CHỮ `dd/MM/yyyy` (khác nhân viên dùng kiểu Date) — theo
 * đúng yêu cầu nghiệp vụ, vì hồ sơ NPT nhiều trường hợp chỉ nhớ áng chừng.
 *
 * Dù lưu chữ vẫn phải soát: không kiểm thì "32/13/2020" trôi thẳng vào DB rồi mọi báo cáo
 * sau này phải tự đoán. Đối chiếu ngược từng phần vì `new Date(2026, 1, 30)` KHÔNG báo lỗi
 * mà tự trôi sang tháng sau.
 */
const ngaySinhVn = optText.superRefine((v, ctx) => {
  if (v === null) return;

  const khop = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!khop) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Ngày sinh phải theo định dạng dd/MM/yyyy',
    });
    return;
  }

  const [, dd, mm, yyyy] = khop;
  const ngay = Number(dd);
  const thang = Number(mm);
  const nam = Number(yyyy);
  const d = new Date(Date.UTC(nam, thang - 1, ngay));
  const coThat =
    d.getUTCFullYear() === nam &&
    d.getUTCMonth() === thang - 1 &&
    d.getUTCDate() === ngay;

  if (!coThat) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Ngày sinh không có thật: ${v}`,
    });
  }
});

const thangDangKy = z
  .number()
  .int('Tháng phải là số nguyên')
  .min(1, 'Tháng phải từ 1 đến 12')
  .max(12, 'Tháng phải từ 1 đến 12')
  .nullable()
  .optional()
  .default(null);

const namDangKy = z
  .number()
  .int('Năm phải là số nguyên')
  .min(2000, 'Năm phải từ 2000 đến 2100')
  .max(2100, 'Năm phải từ 2000 đến 2100')
  .nullable()
  .optional()
  .default(null);

/**
 * Quan hệ để CHỮ TỰ DO (≤50) chứ không ép enum — đúng như yêu cầu nghiệp vụ ghi kiểu dữ liệu
 * là "Chuỗi" (khác Giới tính ghi rõ "chọn từ list"). Danh sách gợi ý Vợ/Chồng/Con/Bố/Mẹ/Anh
 * chị em/Khác nằm ở FE. Ép enum ở đây sẽ chặn oan các quan hệ có thật khác (ông bà, cháu…)
 * mà luật TNCN vẫn cho đăng ký giảm trừ.
 */
const thanBody = z.object({
  ma_nv: z
    .string()
    .trim()
    .min(1, 'Mã nhân viên không được để trống')
    .max(24, 'Mã nhân viên tối đa 24 ký tự')
    .transform((s) => s.toUpperCase()),
  ho_ten: z
    .string()
    .trim()
    .min(1, 'Họ tên người phụ thuộc không được để trống')
    .max(200, 'Họ tên người phụ thuộc tối đa 200 ký tự'),
  quan_he: optTextMax(50, 'Quan hệ'),
  ngay_sinh: ngaySinhVn,
  so_cccd: optTextMax(20, 'Số CCCD'),
  mst: optTextMax(20, 'MST'),
  dien_thoai: optTextMax(20, 'Số điện thoại'),
  dia_chi: optTextMax(255, 'Địa chỉ'),

  dk_tu_thang: thangDangKy,
  dk_tu_nam: namDangKy,
  dk_den_thang: thangDangKy,
  dk_den_nam: namDangKy,
});

/**
 * Kỳ đăng ký giảm trừ phải đọc được: tháng đi kèm năm, và mốc kết thúc không được trước mốc
 * bắt đầu. Thiếu vế nào thì kỳ đó vô nghĩa khi tính thuế TNCN, chặn ngay còn hơn để kế toán
 * phát hiện lúc quyết toán.
 */
function soatKyDangKy(
  v: {
    dk_tu_thang: number | null;
    dk_tu_nam: number | null;
    dk_den_thang: number | null;
    dk_den_nam: number | null;
  },
  ctx: z.RefinementCtx,
): void {
  const capThieuVe: [string, number | null, number | null][] = [
    ['dk_tu_thang', v.dk_tu_thang, v.dk_tu_nam],
    ['dk_den_thang', v.dk_den_thang, v.dk_den_nam],
  ];
  for (const [duong, thang, nam] of capThieuVe) {
    if (thang !== null && nam === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [duong.replace('thang', 'nam')],
        message: 'Có tháng đăng ký thì phải có năm',
      });
    }
    if (nam !== null && thang === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [duong],
        message: 'Có năm đăng ký thì phải có tháng',
      });
    }
  }

  const coDu =
    v.dk_tu_thang !== null &&
    v.dk_tu_nam !== null &&
    v.dk_den_thang !== null &&
    v.dk_den_nam !== null;
  if (coDu) {
    const tu = v.dk_tu_nam! * 12 + v.dk_tu_thang!;
    const den = v.dk_den_nam! * 12 + v.dk_den_thang!;
    if (den < tu) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dk_den_thang'],
        message: 'Kỳ đăng ký đến phải sau hoặc bằng kỳ đăng ký từ',
      });
    }
  }
}

/** Thân request tạo mới 1 người phụ thuộc (hrm_nguoi_phu_thuoc). */
export const nguoiPhuThuocBodySchema = thanBody.superRefine(soatKyDangKy);

/**
 * Thân request sửa: KHÔNG đổi `ma_nv` (chuyển người phụ thuộc sang nhân viên khác là thao tác
 * khác hẳn về nghiệp vụ — xóa rồi tạo lại cho có vết, đừng lặng lẽ đổi chủ).
 */
export const nguoiPhuThuocUpdateSchema = thanBody
  .omit({ ma_nv: true })
  .superRefine(soatKyDangKy);

/** Query danh sách (lọc theo nhân viên / họ tên). */
export const nguoiPhuThuocListQuerySchema = z.object({
  ma_nv: z.string().trim().optional().default(''),
  ho_ten: z.string().trim().optional().default(''),
});

/** Param :id. */
export const nguoiPhuThuocParamSchema = z.object({
  id: z.string().min(1),
});

export type NguoiPhuThuocBodyInput = z.infer<typeof nguoiPhuThuocBodySchema>;
export type NguoiPhuThuocUpdateInput = z.infer<
  typeof nguoiPhuThuocUpdateSchema
>;
export type NguoiPhuThuocListQuery = z.infer<
  typeof nguoiPhuThuocListQuerySchema
>;

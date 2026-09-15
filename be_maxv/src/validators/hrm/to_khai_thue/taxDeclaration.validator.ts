import { z } from 'zod';

/** Kiểm đầu vào cho các endpoint Tờ khai thuế TNCN quý (api-contract Mục 5). */

const nam = z.coerce.number().int().min(2000).max(2100);
const quy = z.coerce.number().int().min(1).max(4);
// BR-tkt-016 / TC-tkt-082: chặn TƯỜNG MINH kỳ tháng mà giao diện cũ còn gửi — không lặng lẽ bỏ qua.
const kyLoai = z.literal('quy').optional();
const ngay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo dạng YYYY-MM-DD')
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s),
    'Ngày không tồn tại',
  );
const nguoiKy = z.string().trim().min(1).max(100);

export const kyToKhaiQuerySchema = z.object({ nam, quy, kyLoai });

export const danhSachKyQuerySchema = z.object({ nam: nam.optional() });

export const ghiDeBodySchema = z.object({
  nam,
  quy,
  kyLoai,
  // `lyDo` để tùy chọn ở đây: thiếu lý do phải ra E-tkt-011 (AC-tkt-026), không phải lỗi hình dạng.
  overrides: z
    .record(
      z.string(),
      z.object({ gia: z.number(), lyDo: z.string().optional() }),
    )
    .refine((o) => Object.keys(o).length > 0, 'Phải gửi ít nhất một chỉ tiêu'),
});

export const xoaGhiDeQuerySchema = z.object({
  nam,
  quy,
  kyLoai,
  ct: z.string().trim().min(1).optional(),
});

export const xuatToKhaiBodySchema = z.object({
  nam,
  quy,
  kyLoai,
  format: z.enum(['excel', 'pdf']),
  nguoiKy: nguoiKy.optional(),
  ngayKy: ngay.optional(),
});

export const taiFileToKhaiQuerySchema = z.object({
  nam,
  quy,
  kyLoai,
  format: z.enum(['excel', 'pdf']),
});

export const bangChiTietQuerySchema = z.object({
  nam,
  quy,
  kyLoai,
  format: z.enum(['excel', 'json']).default('json'),
});

export const danhDauNopBodySchema = z.object({
  nam,
  quy,
  kyLoai,
  nguoiKy: nguoiKy.optional(),
  ngayKy: ngay.optional(),
});

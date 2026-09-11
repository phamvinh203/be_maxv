import { z } from 'zod';

/**
 * Query của các màn tra cứu dữ liệu Dịch vụ công / Giấy nộp tiền ĐÃ ĐỒNG BỘ (đọc DB tenant).
 *
 * Kiểm ở đây thay vì để Prisma tự báo: ngày sai (`2026-13-45`) thành Invalid Date, tham số lặp
 * (`?maHoSo=a&maHoSo=b`) thành mảng — cả hai rơi xuống Prisma thành lỗi kèm đường dẫn file nguồn và
 * đoạn truy vấn (vbsec 2026-09-10). Ô trống FE gửi `""` nghĩa là "không lọc".
 */

const trongThanhThieu = (v: unknown) => (v === '' ? undefined : v);

/** `yyyy-mm-dd` và là ngày có thật (loại 2026-02-30) — service tự ghép giờ, nên giữ nguyên chuỗi. */
const ngayLoc = z.preprocess(
  trongThanhThieu,
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD')
    // Zod vẫn chạy refine khi regex đã hỏng -> phải tự chặn Invalid Date trước `toISOString` (ném RangeError).
    .refine(
      (s) => {
        const d = new Date(`${s}T00:00:00Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
      },
      { message: 'Ngày không có thật' },
    )
    .optional(),
);

/** Ô lọc gõ tự do (contains) — trần độ dài để không ai nhét chuỗi hàng MB vào truy vấn. */
const chuoiLoc = z.preprocess(
  trongThanhThieu,
  z.string().trim().max(200, 'Tối đa 200 ký tự').optional(),
);

export const dvcKhoangNgayQuerySchema = z.object({
  tuNgay: ngayLoc,
  denNgay: ngayLoc,
});

export const dvcTraCuuHoSoQuerySchema = dvcKhoangNgayQuerySchema.extend({
  maHoSo: chuoiLoc,
  maToKhai: chuoiLoc,
});

export const gntTraCuuQuerySchema = dvcKhoangNgayQuerySchema.extend({
  maGiaoDich: chuoiLoc,
  soGnt: chuoiLoc,
});

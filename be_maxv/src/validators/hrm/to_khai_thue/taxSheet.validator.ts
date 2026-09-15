import { z } from 'zod';

/** Kiểm đầu vào cho 3 endpoint Bảng tính thuế tháng (api-contract Mục 4). */

export const taxSheetQuerySchema = z.object({
  periodId: z.string().min(1).max(64),
  loaiLaoDong: z
    .enum(['HOP_DONG_3_THANG_TRO_LEN', 'THOI_VU_THU_VIEC', 'VANG_LAI'])
    .optional(),
  cuTru: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export const lockTaxSheetBodySchema = z.object({
  periodId: z.string().min(1).max(64),
});

export const unlockTaxSheetBodySchema = z.object({
  periodId: z.string().min(1).max(64),
  // Cùng chuẩn "mở lại kỳ lương": thao tác này XÓA snapshot đã chốt và không hoàn tác được, nên
  // bắt buộc để lại lý do đủ dài để người sau đọc nhật ký hiểu vì sao.
  lyDo: z
    .string()
    .trim()
    .min(20, 'Lý do mở lại phải có ít nhất 20 ký tự')
    .max(500),
});

export type TaxSheetQuery = z.infer<typeof taxSheetQuerySchema>;

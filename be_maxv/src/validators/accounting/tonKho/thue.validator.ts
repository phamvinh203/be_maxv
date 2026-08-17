import { z } from 'zod';

/** Query danh sách thuế (GTGT / NK) — lọc theo mã / tên. */
export const thueListQuerySchema = z.object({
  ma_thue: z.string().trim().optional().default(''),
  ten_thue: z.string().trim().optional().default(''),
});

export type ThueListQuery = z.infer<typeof thueListQuerySchema>;

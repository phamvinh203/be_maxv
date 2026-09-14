import { z } from 'zod';

/**
 * Kiểm đầu vào cho 5 endpoint Danh mục loại thu nhập ngoài lương
 * (`api-contract-to-khai-thue.md` Mục 2 · BR-tkt-001…004).
 *
 * Phân vai rõ: schema ở đây lo **hình dạng** (kiểu, độ dài, khoảng giá trị); quan hệ **giữa các
 * trường theo nhóm xử lý thuế** nằm ở `soatThamSoTheoNhom()` bên dưới để cùng một quy tắc phục vụ
 * được cả POST lẫn PUT (PUT gộp giá trị cũ với giá trị mới rồi mới soát).
 */

export const NHOM_XU_LY_THUE = [
  'EXEMPT_FULL',
  'EXEMPT_CAPPED',
  'TAXABLE_FULL',
  'WITHHOLDING_FLAT',
] as const;

const chuKyTran = z.enum(['MONTHLY', 'YEARLY']);
const trangThai = z.enum(['ACTIVE', 'INACTIVE']);

export const listIncomeCategoryQuerySchema = z.object({
  taxTreatmentGroup: z.enum(NHOM_XU_LY_THUE).optional(),
  status: trangThai.optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export const incomeCategoryIdParamsSchema = z.object({
  id: z.string().min(1).max(64),
});

export const createIncomeCategoryBodySchema = z.object({
  // Bỏ trống ⇒ máy chủ tự cấp TN01..TN99 (ADR-001, quét khe trống).
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((s) => s.toUpperCase())
    .optional(),
  name: z.string().trim().min(1).max(200),
  taxTreatmentGroup: z.enum(NHOM_XU_LY_THUE),
  exemptCapAmount: z.number().nonnegative().optional(),
  exemptCapPeriod: chuKyTran.optional(),
  withholdingRate: z.number().min(0).max(100).optional(),
  withholdingThreshold: z.number().nonnegative().optional(),
  legalBasisNote: z.string().trim().max(500).optional(),
  status: trangThai.optional(),
});

/** PUT không nhận `code` — FR-tkt-003 "sửa danh mục, trừ mã". */
export const updateIncomeCategoryBodySchema = createIncomeCategoryBodySchema
  .omit({ code: true })
  .partial()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'Không có trường nào để cập nhật.',
  });

export type CreateIncomeCategoryBody = z.infer<
  typeof createIncomeCategoryBodySchema
>;
export type UpdateIncomeCategoryBody = z.infer<
  typeof updateIncomeCategoryBodySchema
>;

export type NhomXuLyThue = (typeof NHOM_XU_LY_THUE)[number];

interface ThamSoNhom {
  taxTreatmentGroup: NhomXuLyThue;
  exemptCapAmount?: number | null;
  exemptCapPeriod?: 'MONTHLY' | 'YEARLY' | null;
  withholdingRate?: number | null;
  withholdingThreshold?: number | null;
}

/**
 * Soát quan hệ nhóm ↔ tham số (BR-tkt-003). Trả về câu mô tả lỗi, hoặc `null` nếu hợp lệ.
 * Bên gọi ném `E-tkt-003` kèm câu này.
 *
 * Nguyên tắc lấy từ hợp đồng Mục 2.3: *"tham số thừa gây hiểu nhầm; từ chối thay vì lặng lẽ bỏ
 * qua"*. Hợp đồng nêu đích danh hai nhóm `EXEMPT_FULL`/`TAXABLE_FULL`; ở đây áp **cùng nguyên
 * tắc đó cho cả bốn nhóm** — mỗi nhóm chỉ nhận đúng tham số của mình. Nếu BA thấy chặt quá thì
 * nới ở đúng một chỗ này.
 */
export function soatThamSoTheoNhom(ts: ThamSoNhom): string | null {
  const coTran =
    ts.exemptCapAmount !== undefined && ts.exemptCapAmount !== null;
  const coTyLe =
    ts.withholdingRate !== undefined && ts.withholdingRate !== null;
  const coNguong =
    ts.withholdingThreshold !== undefined && ts.withholdingThreshold !== null;

  switch (ts.taxTreatmentGroup) {
    case 'EXEMPT_CAPPED':
      if (!coTran) {
        return 'Nhóm "miễn thuế có trần" bắt buộc phải có mức trần miễn thuế.';
      }
      if (coTyLe || coNguong) {
        return 'Nhóm "miễn thuế có trần" không dùng tỷ lệ hay ngưỡng khấu trừ.';
      }
      return null;

    case 'WITHHOLDING_FLAT':
      // Không đòi tỷ lệ/ngưỡng: bỏ trống thì service điền mặc định 10% / 5.000.000 (AC-tkt-002).
      if (coTran) {
        return 'Nhóm "khấu trừ tại nguồn" không dùng mức trần miễn thuế.';
      }
      return null;

    case 'EXEMPT_FULL':
    case 'TAXABLE_FULL':
      if (coTran || coTyLe || coNguong) {
        return 'Nhóm này miễn hoặc chịu thuế toàn bộ nên không nhận trần miễn thuế, tỷ lệ hay ngưỡng khấu trừ.';
      }
      return null;
  }
}

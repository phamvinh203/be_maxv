import { z } from 'zod';
import { TIEN_KHOAN_TOI_DA } from '../../../constants/hrm/to_khai_thue/gioiHanSo';
import { NHOM_XU_LY_THUE } from './incomeCategory.validator';
import { ngay } from './taxDeclaration.validator';

/**
 * Kiểm đầu vào cho 6 endpoint Bản ghi thu nhập ngoài lương (api-contract Mục 3).
 *
 * Điểm khác bản nháp cũ quan trọng nhất: trường nhập là **`amount`** duy nhất, KHÔNG nhận cả
 * `grossAmount` lẫn `netAmount`. Chỉ một trong hai là số kế toán gõ; số còn lại do công thức
 * BR-tkt-007 suy ra. Cho gửi cả hai là mở đường cho client gửi cặp số không khớp nhau mà máy chủ
 * không biết tin cái nào. Cũng KHÔNG nhận `taxDeductionType` — cách tính thuế do máy chủ suy từ
 * danh mục, để client gửi nghĩa là client tự chọn mình bị khấu trừ bao nhiêu.
 */

const nguoiNhan = {
  // In hoa như mọi validator `du_lieu_ca_nhan` — mã nhân viên luôn được lưu in hoa. Rỗng = vãng lai.
  ma_nv: z
    .string()
    .trim()
    .max(24)
    .nullish()
    .transform((v) => (v ? v.toUpperCase() : null)),
  fullName: z.string().trim().min(1).max(254),
  taxCode: z.string().trim().max(20).nullish(),
  idCardNumber: z.string().trim().max(20).nullish(),
  address: z.string().trim().max(500).nullish(),
  phone: z.string().trim().max(20).nullish(),
  email: z.string().trim().max(100).nullish(),
  isResident: z.boolean().optional(),
};

const khoanChi = {
  otherIncomeCategoryId: z.string().min(1).max(64),
  // Ngày CÓ THẬT (RVW-724): chỉ kiểm dạng chuỗi thì "2026-02-31" lọt qua, V8 cuộn thành 03/03 và lưu sai ngày
  // chứng từ; "2026-13-45" thành Date hỏng, Prisma từ chối ra 500.
  paymentDate: ngay,
  paymentType: z.enum(['GROSS', 'NET']).optional(),
  // Nguyên đồng + có trần (RVW-723): số lẻ dưới đồng lưu thành 0,00; số quá lớn tràn cột Decimal ra 500.
  amount: z
    .number()
    .int('Số tiền phải là số nguyên đồng')
    .positive('Số tiền phải lớn hơn 0')
    .max(TIEN_KHOAN_TOI_DA, 'Số tiền vượt giới hạn cho phép'),
  hasCommitment08: z.boolean().optional(),
  forceWithholding: z.boolean().optional(),
  eWithholdingCertNo: z.string().trim().max(50).nullish(),
  eWithholdingCertDate: ngay.nullish(),
  note: z.string().trim().max(500).nullish(),
};

export const previewOtherIncomeBodySchema = z.object({
  ...nguoiNhan,
  ...khoanChi,
  // Preview không ghi gì nên kỳ là tùy chọn (hợp đồng Mục 3.3).
  periodId: z.string().min(1).max(64).optional(),
});

export const createOtherIncomeBodySchema = z.object({
  periodId: z.string().min(1).max(64),
  ...nguoiNhan,
  ...khoanChi,
});

/** PUT không nhận `periodId` — đổi kỳ làm sai CẢ HAI tháng (hợp đồng Mục 3.5). */
export const updateOtherIncomeBodySchema = z.object({
  ...nguoiNhan,
  ...khoanChi,
});

export const otherIncomeIdParamsSchema = z.object({
  id: z.string().min(1).max(64),
});

export const listOtherIncomeQuerySchema = z.object({
  periodId: z.string().min(1).max(64),
  maNv: z
    .string()
    .trim()
    .max(24)
    .transform((s) => s.toUpperCase())
    .optional(),
  taxDeductionType: z
    .enum([
      'PROGRESSIVE',
      'FLAT_10',
      'FLAT_20',
      'EXEMPT_COMMIT',
      'NO_DEDUCTION',
    ])
    .optional(),
  taxTreatmentGroup: z.enum(NHOM_XU_LY_THUE).optional(),
  isResident: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateOtherIncomeBody = z.infer<typeof createOtherIncomeBodySchema>;
export type UpdateOtherIncomeBody = z.infer<typeof updateOtherIncomeBodySchema>;
export type PreviewOtherIncomeBody = z.infer<
  typeof previewOtherIncomeBodySchema
>;
export type ListOtherIncomeQuery = z.infer<typeof listOtherIncomeQuerySchema>;

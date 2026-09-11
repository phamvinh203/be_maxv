import { z } from 'zod';
import { MST_REGEX } from '../utils/dbName';
import { MESSAGES } from '../constants/messages';
import { emailRule, hoTenRule } from './auth.validator';

// Bước 2: đăng ký công ty (tạo maxv_<mst>_app). ownerId lấy từ JWT, không nhận từ body.
export const registerCompanySchema = z.object({
  tenCongTy: z.string().min(1),
  maSoThue: z.string().regex(MST_REGEX, MESSAGES.VALIDATION.INVALID_MST),
  diaChi: z.string().min(1),
  sdt: z
    .string()
    .regex(/^[0-9]{9,11}$/, MESSAGES.VALIDATION.INVALID_PHONE)
    .optional(),
  loaiHinhKinhDoanh: z.string().min(1).optional(),
});

// PUT /api/v1/companies/:id — owner sửa thông tin công ty. Bỏ maSoThue: MST không đổi
// được sau khi tạo (đã gắn với tenant DB maxv_<mst>_app). Derive từ registerCompanySchema
// để 2 schema không lệch nhau khi sau này đổi rule 1 trong 2 field chung (vd sdt).
export const updateCompanySchema = registerCompanySchema
  .omit({ maSoThue: true })
  .partial();

// DELETE /api/v1/companies/:id — bắt gõ lại MST để xác nhận xóa vĩnh viễn (xem destroyCompany).
// `.trim()` ở đây là điểm chuẩn hóa DUY NHẤT: service chỉ so bằng, không tự cắt khoảng trắng nữa.
export const deleteCompanySchema = z.object({
  maSoThue: z.string().trim().regex(MST_REGEX, MESSAGES.VALIDATION.INVALID_MST),
});

// POST /api/v1/companies/invite
// Role luôn là OWNER_EMPLOYEE (gán ở service) — owner đặt tên + chức vụ + chọn MST cấp quyền.
export const inviteUserSchema = z.object({
  // Phải chuẩn hoá như mọi email khác: mời "Ketoan@ABC.vn" sẽ tạo user đúng chữ hoa đó,
  // rồi luồng quên mật khẩu (gõ chữ thường) không tìm thấy và im lặng không gửi gì.
  email: emailRule,
  // Cả hai được nhúng vào email gửi mọi admin ("Nhân viên được mời: …") — cùng luật họ tên của đăng ký
  // (vbsec 2026-09-10), chức vụ cũng không cho xuống dòng.
  hoTen: hoTenRule,
  chucVu: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[^\r\n]+$/, 'Chức vụ không được xuống dòng'),
  donViIds: z.array(z.string().uuid()).min(1), // các MST (của owner) cấp cho nhân viên
});

/**
 * PUT /api/v1/companies/employees/:userId/access — đặt lại tập MST của 1 nhân viên
 * (rỗng = thu hồi hết), kèm QUYỀN XEM DỮ LIỆU LƯƠNG cho từng công ty (QĐ #8, FR-hrm-044).
 *
 * Nhận HAI dạng thân yêu cầu:
 *   - `access: [{ donViId, xemLuong }]` — dạng đầy đủ theo contract Mục 7C.1, dùng cho màn
 *     phân quyền có ô tick quyền lương;
 *   - `donViIds: ["..."]` — dạng cũ, GIỮ LẠI để giao diện `maxv/` hiện tại không chết ngay khi
 *     máy chủ lên trước. Dạng cũ **không nói gì về quyền lương** nên máy chủ GIỮ NGUYÊN cờ của
 *     các cặp đã có và để cặp mới ở mặc định "không được xem" — đúng tinh thần QĐ #17.
 *
 * Ít nhất một trong hai phải có mặt.
 */
export const setEmployeeAccessSchema = z
  .object({
    access: z
      .array(
        z.object({
          donViId: z.string().uuid(),
          // `optional` chứ không `default(false)`: "không gửi" phải mang nghĩa GIỮ NGUYÊN cờ cũ,
          // khác hẳn "gửi false" = thu hồi. Gộp hai thứ đó là thu hồi quyền âm thầm.
          xemLuong: z.boolean().optional(),
        }),
      )
      .optional(),
    donViIds: z.array(z.string().uuid()).optional(),
  })
  .refine((v) => v.access !== undefined || v.donViIds !== undefined, {
    message: 'Phải gửi danh sách công ty (access hoặc donViIds)',
    path: ['access'],
  })
  .transform((v) => ({
    access: v.access ?? (v.donViIds ?? []).map((donViId) => ({ donViId })),
  }));

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type SetEmployeeAccessInput = z.infer<typeof setEmployeeAccessSchema>;
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type DeleteCompanyInput = z.infer<typeof deleteCompanySchema>;

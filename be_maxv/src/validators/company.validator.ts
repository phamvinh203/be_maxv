import { z } from 'zod';
import { MST_REGEX } from '../utils/dbName';
import { MESSAGES } from '../constants/messages';
import { emailRule } from './auth.validator';


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
  hoTen: z.string().min(1),
  chucVu: z.string().trim().min(1).max(100),
  donViIds: z.array(z.string().uuid()).min(1), // các MST (của owner) cấp cho nhân viên
});

// PUT /api/v1/companies/employees/:userId/access — đặt lại tập MST của 1 nhân viên (rỗng = thu hồi hết).
export const setEmployeeAccessSchema = z.object({
  donViIds: z.array(z.string().uuid()),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type SetEmployeeAccessInput = z.infer<typeof setEmployeeAccessSchema>;
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type DeleteCompanyInput = z.infer<typeof deleteCompanySchema>;


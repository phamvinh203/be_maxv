import { z } from 'zod';
import { MST_REGEX } from '../utils/dbName';
import { MESSAGES } from '../constants/messages';


// Bước 2: đăng ký công ty (tạo maxv2_<mst>_app). ownerId lấy từ JWT, không nhận từ body.
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

// PUT /api/v1/companies/:id — owner sửa thông tin công ty. Không có maSoThue: MST không đổi
// được sau khi tạo (đã gắn với tenant DB maxv2_<mst>_app).
export const updateCompanySchema = z.object({
  tenCongTy: z.string().min(1).optional(),
  diaChi: z.string().min(1).optional(),
  sdt: z
    .string()
    .regex(/^[0-9]{9,11}$/, MESSAGES.VALIDATION.INVALID_PHONE)
    .optional(),
  loaiHinhKinhDoanh: z.string().min(1).optional(),
});

// POST /api/v1/companies/invite
// Role luôn là OWNER_EMPLOYEE (gán ở service) — owner đặt tên + chức vụ + chọn MST cấp quyền.
export const inviteUserSchema = z.object({
  email: z.string().email(),
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


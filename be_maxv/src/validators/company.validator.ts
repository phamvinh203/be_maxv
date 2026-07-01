import { z } from 'zod';
import { MST_REGEX } from '../utils/dbName';
import { MESSAGES } from '../constants/messages';


// Bước 2: đăng ký công ty (tạo maxv2_<mst>_app)
export const registerCompanySchema = z.object({
  // TODO: bỏ userId khi có JWT auth — lấy từ token. Tạm dùng để test phía admin.
  userId: z.string().uuid(),
  tenCongTy: z.string().min(1),
  maSoThue: z.string().regex(MST_REGEX, MESSAGES.VALIDATION.INVALID_MST),
  diaChi: z.string().min(1),
  sdt: z
    .string()
    .regex(/^[0-9]{9,11}$/, MESSAGES.VALIDATION.INVALID_PHONE)
    .optional(),
  loaiHinhKinhDoanh: z.string().min(1).optional(),
});

// POST /api/v1/companies/invite
// Role luôn là OWNER_EMPLOYEE (gán ở service) — owner chỉ đặt tên + chức vụ tự do.
export const inviteUserSchema = z.object({
  email: z.string().email(),
  hoTen: z.string().min(1),
  chucVu: z.string().trim().min(1).max(100),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;


import { z } from 'zod';
import { MST_REGEX } from '../utils/dbName';
import { MESSAGES } from '../constants/messages';

// Bước 1: đăng ký người dùng (lưu vào maxv2_sys)
export const registerSchema = z.object({
  hoTen: z.string().min(1),
  email: z.string().email(),
  sdt: z
    .string()
    .regex(/^[0-9]{9,11}$/, MESSAGES.VALIDATION.INVALID_PHONE)
    .optional(),
  password: z
    .string()
    .min(8, MESSAGES.VALIDATION.PASSWORD_MIN)
    .regex(/[A-Za-z]/, MESSAGES.VALIDATION.PASSWORD_LETTER)
    .regex(/[0-9]/, MESSAGES.VALIDATION.PASSWORD_NUMBER),
});

// Đăng nhập
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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
  loaiHinhKinhDoanh: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;

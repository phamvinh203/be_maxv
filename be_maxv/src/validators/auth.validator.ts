import { z } from 'zod';
import { MESSAGES } from '../constants/messages';

// Bước 1: đăng ký người dùng (lưu vào maxv2_sys)
export const registerSchema = z.object({
  // Chặn độ dài + xuống dòng: `hoTen` được nhúng nguyên văn vào email chào mừng gửi từ
  // địa chỉ đã xác thực của hệ thống (xem welcomeEmail). Không giới hạn thì /register —
  // vốn không cần đăng nhập — thành kênh phát tán nội dung tùy ý dưới danh nghĩa MaxV.
  hoTen: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[^\r\n]+$/, MESSAGES.VALIDATION.INVALID_NAME),
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


export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

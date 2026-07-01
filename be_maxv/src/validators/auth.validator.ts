import { z } from 'zod';
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


export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

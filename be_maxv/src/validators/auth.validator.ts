import { z } from 'zod';
import { MESSAGES } from '../constants/messages';
import { OTP_LENGTH } from '../constants/auth';

/**
 * Luật mật khẩu dùng chung cho đăng ký và đặt lại mật khẩu — khai một lần để hai
 * luồng không lệch nhau (đặt lại mà lỏng hơn đăng ký là một đường vòng hạ cấp mật khẩu).
 */
const passwordRule = z
  .string()
  .min(8, MESSAGES.VALIDATION.PASSWORD_MIN)
  .regex(/[A-Za-z]/, MESSAGES.VALIDATION.PASSWORD_LETTER)
  .regex(/[0-9]/, MESSAGES.VALIDATION.PASSWORD_NUMBER);

/**
 * Email chuẩn hoá: cắt khoảng trắng + hạ chữ thường TRƯỚC khi so sánh.
 *
 * Bắt buộc dùng ở MỌI schema nhận email. Postgres so chuỗi phân biệt hoa thường, nên
 * đăng ký "Ketoan@ABC.vn" rồi quên mật khẩu gõ "ketoan@abc.vn" sẽ không khớp — và luồng
 * quên mật khẩu (cố tình im lặng khi không thấy email, để chống dò tài khoản) sẽ che mất
 * luôn lỗi đó: người dùng chờ mã mãi không tới mà không ai giải thích được vì sao.
 * Export để company.validator dùng chung — thiếu một chỗ là thủng cả chuỗi.
 */
export const emailRule = z.string().trim().toLowerCase().email();

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
  email: emailRule,
  sdt: z
    .string()
    .regex(/^[0-9]{9,11}$/, MESSAGES.VALIDATION.INVALID_PHONE)
    .optional(),
  password: passwordRule,
});

// Bước 1 quên mật khẩu: xin OTP gửi về email.
export const forgotPasswordSchema = z.object({
  email: emailRule,
});

// Bước 2: gửi kèm OTP + mật khẩu mới trong cùng 1 request.
export const resetPasswordSchema = z.object({
  email: emailRule,
  otp: z
    .string()
    .trim()
    .regex(new RegExp(`^[0-9]{${OTP_LENGTH}}$`), MESSAGES.VALIDATION.INVALID_OTP),
  newPassword: passwordRule,
});

// Đăng nhập
export const loginSchema = z.object({
  email: emailRule,
  password: z.string().min(1),
});


export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

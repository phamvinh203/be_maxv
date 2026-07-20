import { randomInt } from 'node:crypto';
import { OTP_LENGTH } from '../constants/auth';

/**
 * Sinh mã OTP gồm `OTP_LENGTH` chữ số, giữ nguyên số 0 ở đầu (vd "004821").
 *
 * Dùng `crypto.randomInt` chứ KHÔNG dùng `Math.random`: mã này là yếu tố xác thực
 * duy nhất để đổi mật khẩu, nên nguồn ngẫu nhiên phải là loại dùng cho mật mã.
 * `randomInt` cũng tránh được lệch phân phối (modulo bias) khi lấy dư.
 * Dùng: `requestPasswordReset` (services/client/auth.service.ts).
 */
export function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  return String(randomInt(0, max)).padStart(OTP_LENGTH, '0');
}

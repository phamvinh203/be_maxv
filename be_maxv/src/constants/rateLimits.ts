/**
 * Preset rate-limit dùng chung cho route option thứ 2 (`app.post(path, PRESET, handler)`).
 * Giới hạn mặc định toàn app (300/phút) đăng ký ở app.ts — các preset ở đây CHỈ dùng để
 * siết chặt hơn cho route nhạy cảm cụ thể (login/register và các route tương tự sau này).
 */

/** Route dễ bị dò/spam (login, register, đặt lại mật khẩu, mời nhân viên...). */
export const STRICT_AUTH_LIMIT = {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
};

/**
 * Hằng số dùng chung cho refresh token cookie.
 * Gom 1 chỗ để jwt.plugin (đọc cookie) và auth.controller (ghi/xóa cookie)
 * không viết tay trùng tên/đường dẫn.
 */
export const REFRESH_COOKIE = 'refreshToken';

// Cookie chỉ được gửi kèm cho các route dưới đường dẫn này (khớp prefix /auth).
export const REFRESH_PATH = '/api/v1/auth';

// Access token cũng để cookie httpOnly (không đọc được bằng JS -> miễn nhiễm đánh cắp qua XSS).
// Gửi kèm mọi route API (path /api/v1), nên jwt.plugin đọc token từ đây thay vì header.
export const ACCESS_COOKIE = 'accessToken';
export const ACCESS_PATH = '/api/v1';

// ---------------- OTP đặt lại mật khẩu ----------------

/** Độ dài mã OTP (chữ số). */
export const OTP_LENGTH = 6;

/** Hiệu lực của OTP tính bằng phút — cũng là con số in trong email. */
export const OTP_TTL_MINUTES = 10;

/**
 * Số lần nhập sai tối đa cho MỘT mã. Chạm trần -> mã chết, phải xin mã mới.
 * Bắt buộc phải có: 6 chữ số chỉ có 10^6 khả năng, không giới hạn thì dò được trong TTL.
 */
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Số OTP tối đa phát cho MỘT email trong 1 giờ. Rate limit của Fastify tính theo IP,
 * nên riêng ngưỡng này mới chặn được việc đổi IP để dội mail vào hộp thư nạn nhân.
 */
export const OTP_MAX_PER_HOUR = 3;

/**
 * Hằng số dùng chung cho refresh token cookie.
 * Gom 1 chỗ để jwt.plugin (đọc cookie) và auth.controller (ghi/xóa cookie)
 * không viết tay trùng tên/đường dẫn.
 */
export const REFRESH_COOKIE = 'refreshToken';

// Cookie chỉ được gửi kèm cho các route dưới đường dẫn này (khớp prefix /auth).
export const REFRESH_PATH = '/api/v1/auth';

import type { FastifyReply } from 'fastify';
import { ACCESS_COOKIE, ACCESS_PATH, REFRESH_COOKIE, REFRESH_PATH } from '../constants/auth';
import { env } from '../config/env';
import { currentTokenVersion } from '../services/client/auth.service';

/** Payload access/refresh token — donViId = công ty đang chọn (null nếu chưa chọn). */
export interface TokenPayload {
  userId: string;
  donViId: string | null;
  role: string;
  /**
   * Bản của bộ token. `loadUserForRefresh` so với `users.tokenVersion`; đổi/đặt lại mật
   * khẩu sẽ tăng cột đó khiến mọi refresh token đã phát trở nên vô hiệu.
   * Lưu ý: access token (15 phút) KHÔNG đối chiếu DB, nên nó vẫn sống tới khi tự hết hạn.
   */
  tokenVersion: number;
}

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.nodeEnv === 'production',
  path: REFRESH_PATH,
  maxAge: env.refreshTtlSec,
};

// Access cookie: SameSite=Strict chống CSRF (app cùng origin). maxAge dài như refresh — token
// bên trong tự hết hạn theo accessTtl (15m), hết hạn thì user đăng nhập lại (chưa auto-refresh).
const accessCookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: env.nodeEnv === 'production',
  path: ACCESS_PATH,
  maxAge: env.refreshTtlSec,
};

/**
 * Ký access + refresh cho 1 user và đặt CẢ HAI vào cookie httpOnly (access: SameSite=Strict,
 * refresh: SameSite=Lax). Dùng chung cho login, đổi công ty (switch), và tạo công ty (auto-switch).
 * Vẫn trả về access token (phòng khi cần dùng nội bộ), nhưng client dùng cookie là chính.
 */
/**
 * Cấp lại bộ token cho user ĐANG đăng nhập, chỉ đổi công ty đang chọn. Dùng ở mọi chỗ đổi
 * `donViId` giữa phiên: tạo công ty (activate), đổi công ty (switch), xóa công ty đang dùng.
 *
 * Tồn tại để `tokenVersion` chỉ có MỘT đường lấy: đọc từ DB. `req.user.tokenVersion` là giá trị CŨ
 * theo thiết kế (access token không đối chiếu DB — xem jwt.plugin.ts), nên ký token mới bằng nó sẽ
 * hồi sinh phiên đáng lẽ đã bị thu hồi. Trước đây quy tắc đó được giữ bằng cách chép đúng ở 3 chỗ.
 */
export async function reissueSession(
  reply: FastifyReply,
  user: { userId: string; role: string },
  donViId: string | null,
): Promise<string> {
  return issueTokens(reply, {
    userId: user.userId,
    donViId,
    role: user.role,
    tokenVersion: await currentTokenVersion(user.userId),
  });
}

export async function issueTokens(
  reply: FastifyReply,
  payload: TokenPayload,
): Promise<string> {
  // 2 thao tác ký độc lập -> chạy song song để giảm độ trễ.
  const [accessToken, refreshToken] = await Promise.all([
    reply.jwtSign(payload, { expiresIn: env.accessTtl }),
    reply.refreshJwtSign(payload, { expiresIn: env.refreshTtlSec }),
  ]);
  reply.setCookie(ACCESS_COOKIE, accessToken, accessCookieOptions);
  reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  return accessToken;
}

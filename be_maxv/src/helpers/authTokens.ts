import type { FastifyReply } from 'fastify';
import { ACCESS_COOKIE, ACCESS_PATH, REFRESH_COOKIE, REFRESH_PATH } from '../constants/auth';
import { env } from '../config/env';
import { loadUserForReissue } from '../services/client/auth.service';
import { giaHanPhien, moPhien } from '../services/client/phienDangNhap.service';

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
  /**
   * Id phiên đăng nhập phía server (`refresh_sessions`, xem phienDangNhap.service.ts). Vắng = token ký
   * TRƯỚC khi có phiên phía server; làm mới / cấp lại lần kế tiếp sẽ chuyển nó sang một phiên mới.
   */
  sid?: string;
}

/** Đăng nhập: mở phiên mới phía server rồi ký bộ token gắn với phiên đó. */
export async function batDauPhien(
  reply: FastifyReply,
  payload: Omit<TokenPayload, 'sid'>,
): Promise<string> {
  const { sid, jti } = await moPhien(payload.userId);
  return issueTokens(reply, { ...payload, sid }, jti);
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
 * Cấp lại bộ token cho user ĐANG đăng nhập, chỉ đổi công ty đang chọn. Dùng ở mọi chỗ đổi
 * `donViId` giữa phiên: tạo công ty (activate), đổi công ty (switch), xóa công ty đang dùng.
 *
 * Vé đang dùng (`user` = `req.user`) phải còn hiệu lực theo DB — cùng quy tắc với refresh
 * (`loadUserForReissue`): user bị khóa hoặc `tokenVersion` của vé lệch DB (đã đặt lại mật khẩu)
 * -> 401, KHÔNG "nâng cấp" vé cũ lên version mới. Role ký vào vé mới đọc từ DB, không lấy từ JWT cũ.
 * Phiên phía server của vé cũng phải còn sống: đã đăng xuất thì 401 dù access token còn hạn.
 */
export async function reissueSession(
  reply: FastifyReply,
  user: { userId: string; role: string; tokenVersion?: number; sid?: string },
  donViId: string | null,
): Promise<string> {
  const phien = await loadUserForReissue(user.userId, user.tokenVersion);
  const payload = {
    userId: user.userId,
    donViId,
    role: phien.role,
    tokenVersion: phien.tokenVersion,
  };
  // Access token ký trước khi có phiên phía server (sống tối đa 15 phút sau khi triển khai).
  if (!user.sid) return batDauPhien(reply, payload);
  const jti = await giaHanPhien(user.sid, user.userId);
  return issueTokens(reply, { ...payload, sid: user.sid }, jti);
}

/**
 * Ký access + refresh cho 1 phiên và đặt CẢ HAI vào cookie httpOnly (access: SameSite=Strict,
 * refresh: SameSite=Lax). Không gọi thẳng từ controller: đăng nhập đi qua `batDauPhien`, đổi công ty
 * GIỮA PHIÊN qua `reissueSession`, làm mới qua `xoayPhien` — để `sid`/`jti` luôn khớp phiên phía server.
 * Vẫn trả về access token (phòng khi cần dùng nội bộ), nhưng client dùng cookie là chính.
 */
export async function issueTokens(
  reply: FastifyReply,
  payload: TokenPayload & { sid: string },
  jti: string,
): Promise<string> {
  // 2 thao tác ký độc lập -> chạy song song để giảm độ trễ. `jti` chỉ nằm trong refresh token.
  const [accessToken, refreshToken] = await Promise.all([
    reply.jwtSign(payload, { expiresIn: env.accessTtl }),
    reply.refreshJwtSign({ ...payload, jti }, { expiresIn: env.refreshTtlSec }),
  ]);
  reply.setCookie(ACCESS_COOKIE, accessToken, accessCookieOptions);
  reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  return accessToken;
}

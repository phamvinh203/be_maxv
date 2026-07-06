import type { FastifyReply } from 'fastify';
import { REFRESH_COOKIE, REFRESH_PATH } from '../constants/auth';
import { env } from '../config/env';

/** Payload access/refresh token — donViId = công ty đang chọn (null nếu chưa chọn). */
export interface TokenPayload {
  userId: string;
  donViId: string | null;
  role: string;
}

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.nodeEnv === 'production',
  path: REFRESH_PATH,
  maxAge: env.refreshTtlSec,
};

/**
 * Ký access (trả về body) + refresh (đặt cookie httpOnly) cho 1 user.
 * Dùng chung cho login, đổi công ty (switch), và tạo công ty (auto-switch).
 */
export async function issueTokens(
  reply: FastifyReply,
  payload: TokenPayload,
): Promise<string> {
  // 2 thao tác ký độc lập -> chạy song song để giảm độ trễ.
  const [accessToken, refreshToken] = await Promise.all([
    reply.jwtSign(payload, { expiresIn: env.accessTtl }),
    reply.refreshJwtSign(payload, { expiresIn: env.refreshTtlSec }),
  ]);
  reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  return accessToken;
}

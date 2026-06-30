import type { FastifyRequest, FastifyReply } from 'fastify';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import {
  registerUser,
  loginUser,
  loadUserForRefresh,
} from '../services/auth.service';
import { validateBody } from '../utils/validate';
import { sendCreated, sendOk } from '../helpers/response';
import { UnauthorizedError } from '../helpers/errors';
import { MESSAGES } from '../constants/messages';
import { REFRESH_COOKIE, REFRESH_PATH } from '../constants/auth';
import { env } from '../config/env';

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.nodeEnv === 'production',
  path: REFRESH_PATH,
  maxAge: env.refreshTtlSec,
};

/** Ký access (body) + refresh (cookie httpOnly) cho 1 user. */
async function issueTokens(
  reply: FastifyReply,
  payload: { userId: string; donViId: string | null; role: string },
): Promise<string> {
  // 2 thao tác ký độc lập -> chạy song song để giảm độ trễ login/refresh.
  const [accessToken, refreshToken] = await Promise.all([
    reply.jwtSign(payload, { expiresIn: env.accessTtl }),
    reply.refreshJwtSign(payload, { expiresIn: env.refreshTtlSec }),
  ]);
  reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  return accessToken;
}

/** POST /api/v1/auth/register — Bước 1: đăng ký người dùng. */
export async function register(req: FastifyRequest, reply: FastifyReply) {
  const data = await registerUser(validateBody(registerSchema, req.body));
  return sendCreated(reply, data);
}

/** POST /api/v1/auth/login — đăng nhập, trả access token + context công ty. */
export async function login(req: FastifyRequest, reply: FastifyReply) {
  const { user, company } = await loginUser(validateBody(loginSchema, req.body));
  const accessToken = await issueTokens(reply, {
    userId: user.id,
    donViId: user.donViId,
    role: user.role,
  });
  return sendOk(reply, { accessToken, user, company });
}

/** POST /api/v1/auth/refresh — cấp access token mới từ refresh cookie. */
export async function refresh(req: FastifyRequest, reply: FastifyReply) {
  let userId: string;
  try {
    ({ userId } = await req.refreshJwtVerify());
  } catch {
    throw new UnauthorizedError(MESSAGES.AUTH.REFRESH_INVALID);
  }

  const ctx = await loadUserForRefresh(userId);
  const accessToken = await issueTokens(reply, {
    userId: ctx.id,
    donViId: ctx.donViId,
    role: ctx.role,
  });
  return sendOk(reply, { accessToken });
}

/** POST /api/v1/auth/logout — xóa refresh cookie. */
export async function logout(req: FastifyRequest, reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
  return sendOk(reply, { message: MESSAGES.AUTH.LOGOUT_OK });
}

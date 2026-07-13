import type { FastifyRequest, FastifyReply } from 'fastify';
import { registerSchema, loginSchema } from '../../validators/auth.validator';
import {
  registerUser,
  loginUser,
  loadUserForRefresh,
  loadUserSession,
} from '../../services/client/auth.service';
import { validateBody } from '../../utils/validate';
import { sendCreated, sendOk } from '../../helpers/response';
import { UnauthorizedError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import {
  ACCESS_COOKIE,
  ACCESS_PATH,
  REFRESH_COOKIE,
  REFRESH_PATH,
} from '../../constants/auth';
import { issueTokens } from '../../helpers/authTokens';

/** POST /api/v1/auth/register — Bước 1: đăng ký người dùng. */
export async function register(req: FastifyRequest, reply: FastifyReply) {
  const data = await registerUser(validateBody(registerSchema, req.body));
  return sendCreated(reply, data);
}

/** POST /api/v1/auth/login — đăng nhập; access + refresh đặt vào cookie httpOnly, body chỉ trả user/công ty. */
export async function login(req: FastifyRequest, reply: FastifyReply) {
  const { user, companies, activeDonViId } = await loginUser(
    validateBody(loginSchema, req.body),
  );
  await issueTokens(reply, {
    userId: user.id,
    donViId: activeDonViId,
    role: user.role,
  });
  return sendOk(reply, { user, companies, activeDonViId });
}

/** GET /api/v1/auth/me — nạp phiên hiện tại từ access cookie (bootstrap FE khi tải trang). */
export async function me(req: FastifyRequest, reply: FastifyReply) {
  const session = await loadUserSession(req.user.userId, req.user.donViId);
  return sendOk(reply, session);
}

/** POST /api/v1/auth/refresh — cấp access token (cookie) mới từ refresh cookie. */
export async function refresh(req: FastifyRequest, reply: FastifyReply) {
  let userId: string;
  let donViId: string | null;
  try {
    ({ userId, donViId } = await req.refreshJwtVerify());
  } catch {
    throw new UnauthorizedError(MESSAGES.AUTH.REFRESH_INVALID);
  }

  const ctx = await loadUserForRefresh(userId, donViId);
  await issueTokens(reply, {
    userId: ctx.id,
    donViId: ctx.donViId,
    role: ctx.role,
  });
  return sendOk(reply, { activeDonViId: ctx.donViId });
}

/** POST /api/v1/auth/logout — xóa cả access lẫn refresh cookie. */
export async function logout(req: FastifyRequest, reply: FastifyReply) {
  reply.clearCookie(ACCESS_COOKIE, { path: ACCESS_PATH });
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
  return sendOk(reply, { message: MESSAGES.AUTH.LOGOUT_OK });
}

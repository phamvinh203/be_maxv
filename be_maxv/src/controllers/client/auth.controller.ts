import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../validators/auth.validator';
import {
  registerUser,
  loginUser,
  loadUserForRefresh,
  loadUserSession,
  requestPasswordReset,
  resetPasswordWithOtp,
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
  const { user, tokenVersion, companies, activeDonViId, modules } =
    await loginUser(validateBody(loginSchema, req.body));
  await issueTokens(reply, {
    userId: user.id,
    donViId: activeDonViId,
    role: user.role,
    tokenVersion,
  });
  return sendOk(reply, { user, companies, activeDonViId, modules });
}

/**
 * POST /api/v1/auth/forgot-password — gửi OTP về email.
 * LUÔN trả cùng một message dù email có tồn tại hay không (chống dò tài khoản).
 */
export async function forgotPassword(req: FastifyRequest, reply: FastifyReply) {
  await requestPasswordReset(validateBody(forgotPasswordSchema, req.body));
  return sendOk(reply, { message: MESSAGES.AUTH.FORGOT_PASSWORD_SENT });
}

/**
 * POST /api/v1/auth/reset-password — đối chiếu OTP + đặt mật khẩu mới.
 * Thành công thì mọi refresh token cũ hết hiệu lực -> người dùng phải đăng nhập lại.
 */
export async function resetPassword(req: FastifyRequest, reply: FastifyReply) {
  await resetPasswordWithOtp(validateBody(resetPasswordSchema, req.body));
  // Xoá luôn cookie của chính trình duyệt đang thao tác cho khỏi treo phiên nửa vời.
  reply.clearCookie(ACCESS_COOKIE, { path: ACCESS_PATH });
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
  return sendOk(reply, { message: MESSAGES.AUTH.RESET_PASSWORD_OK });
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
  let tokenVersion: number;
  try {
    ({ userId, donViId, tokenVersion } = await req.refreshJwtVerify());
  } catch {
    throw new UnauthorizedError(MESSAGES.AUTH.REFRESH_INVALID);
  }

  const ctx = await loadUserForRefresh(userId, donViId, tokenVersion);
  await issueTokens(reply, {
    userId: ctx.id,
    donViId: ctx.donViId,
    role: ctx.role,
    tokenVersion: ctx.tokenVersion,
  });
  return sendOk(reply, { activeDonViId: ctx.donViId });
}

/** POST /api/v1/auth/logout — xóa cả access lẫn refresh cookie. */
export async function logout(req: FastifyRequest, reply: FastifyReply) {
  reply.clearCookie(ACCESS_COOKIE, { path: ACCESS_PATH });
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
  return sendOk(reply, { message: MESSAGES.AUTH.LOGOUT_OK });
}

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
import { batDauPhien, issueTokens } from '../../helpers/authTokens';
import {
  thuHoiPhien,
  xoayPhien,
} from '../../services/client/phienDangNhap.service';

/** POST /api/v1/auth/register — Bước 1: đăng ký người dùng. */
export async function register(req: FastifyRequest, reply: FastifyReply) {
  const data = await registerUser(validateBody(registerSchema, req.body));
  return sendCreated(reply, data);
}

/** POST /api/v1/auth/login — đăng nhập; access + refresh đặt vào cookie httpOnly, body chỉ trả user/công ty. */
export async function login(req: FastifyRequest, reply: FastifyReply) {
  const { user, tokenVersion, companies, activeDonViId, modules } =
    await loginUser(validateBody(loginSchema, req.body));
  await batDauPhien(reply, {
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

/**
 * POST /api/v1/auth/refresh — cấp bộ token (cookie) mới từ refresh cookie, XOAY `jti` của phiên
 * (`xoayPhien`): refresh token vừa dùng trở thành "cũ", dùng lại quá ân hạn là hủy cả phiên.
 */
export async function refresh(req: FastifyRequest, reply: FastifyReply) {
  let ve: Awaited<ReturnType<FastifyRequest['refreshJwtVerify']>>;
  try {
    ve = await req.refreshJwtVerify();
  } catch {
    throw new UnauthorizedError(MESSAGES.AUTH.REFRESH_INVALID);
  }

  const ctx = await loadUserForRefresh(ve.userId, ve.donViId, ve.tokenVersion);
  const payload = {
    userId: ctx.id,
    donViId: ctx.donViId,
    role: ctx.role,
    tokenVersion: ctx.tokenVersion,
  };
  if (ve.sid) {
    const jti = await xoayPhien(ve.sid, ve.jti, ctx.id);
    await issueTokens(reply, { ...payload, sid: ve.sid }, jti);
  } else {
    // Refresh token ký TRƯỚC khi có phiên phía server: chuyển sang một phiên mới. Bỏ nhánh này sau
    // `refreshTtl` kể từ ngày triển khai — khi đó mọi token không có `sid` đã hết hạn.
    await batDauPhien(reply, payload);
  }
  return sendOk(reply, { activeDonViId: ctx.donViId });
}

/** `sid` của phiên đang gửi request: ưu tiên refresh cookie, mất thì lấy từ access cookie. */
async function sidCuaRequest(req: FastifyRequest): Promise<string | undefined> {
  try {
    const sid = (await req.refreshJwtVerify()).sid;
    if (sid) return sid;
  } catch {
    // Không có / hết hạn / sai chữ ký — thử access cookie.
  }
  try {
    return (await req.jwtVerify<{ sid?: string }>()).sid;
  } catch {
    return undefined;
  }
}

/**
 * POST /api/v1/auth/logout — THU HỒI phiên phía server rồi xóa cả access lẫn refresh cookie.
 * Chỉ xóa cookie thì refresh token đã lộ vẫn làm mới được thêm 7 ngày, gia hạn mãi.
 * Không cần đăng nhập, không có cookie nào vẫn 200 (idempotent).
 */
export async function logout(req: FastifyRequest, reply: FastifyReply) {
  const sid = await sidCuaRequest(req);
  if (sid) await thuHoiPhien(sid);
  reply.clearCookie(ACCESS_COOKIE, { path: ACCESS_PATH });
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
  return sendOk(reply, { message: MESSAGES.AUTH.LOGOUT_OK });
}

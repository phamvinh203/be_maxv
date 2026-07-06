import type { FastifyRequest, FastifyReply } from 'fastify';
import { registerSchema, loginSchema } from '../../validators/auth.validator';
import {
  registerUser,
  loginUser,
  loadUserForRefresh,
} from '../../services/client/auth.service';
import { validateBody } from '../../utils/validate';
import { sendCreated, sendOk } from '../../helpers/response';
import { UnauthorizedError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import { REFRESH_COOKIE, REFRESH_PATH } from '../../constants/auth';
import { issueTokens } from '../../helpers/authTokens';

/** POST /api/v1/auth/register — Bước 1: đăng ký người dùng. */
export async function register(req: FastifyRequest, reply: FastifyReply) {
  const data = await registerUser(validateBody(registerSchema, req.body));
  return sendCreated(reply, data);
}

/** POST /api/v1/auth/login — đăng nhập, trả access token + danh sách công ty được phép. */
export async function login(req: FastifyRequest, reply: FastifyReply) {
  const { user, companies, activeDonViId } = await loginUser(
    validateBody(loginSchema, req.body),
  );
  const accessToken = await issueTokens(reply, {
    userId: user.id,
    donViId: activeDonViId,
    role: user.role,
  });
  return sendOk(reply, { accessToken, user, companies, activeDonViId });
}

/** POST /api/v1/auth/refresh — cấp access token mới từ refresh cookie. */
export async function refresh(req: FastifyRequest, reply: FastifyReply) {
  let userId: string;
  let donViId: string | null;
  try {
    ({ userId, donViId } = await req.refreshJwtVerify());
  } catch {
    throw new UnauthorizedError(MESSAGES.AUTH.REFRESH_INVALID);
  }

  const ctx = await loadUserForRefresh(userId, donViId);
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

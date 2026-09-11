import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import type { FastifyRequest } from 'fastify';
import { env } from '../config/env';
import { UnauthorizedError, ForbiddenError } from '../helpers/errors';
import { sysPrisma } from '../config/db.sys';
import { MESSAGES } from '../constants/messages';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../constants/auth';
import type { Role } from '../generated/sys';

/**
 * Fastify plugin: cấu hình JWT (@fastify/jwt) + decorator `authenticate`.
 * - Access token: instance mặc định -> reply.jwtSign / req.jwtVerify / req.user
 * - Refresh token: namespace 'refresh' (secret riêng) -> reply.refreshJwtSign /
 *   req.refreshJwtVerify (xem types/fastify.d.ts).
 */
export default fp(
  async (app) => {
    // Access: jwtVerify() đọc token từ cookie httpOnly (fallback header Authorization nếu có).
    app.register(fjwt, {
      secret: env.jwtAccessSecret,
      cookie: { cookieName: ACCESS_COOKIE, signed: false },
    });
    app.register(fjwt, {
      secret: env.jwtRefreshSecret,
      namespace: 'refresh',
      // refreshJwtVerify() đọc token trực tiếp từ cookie httpOnly
      cookie: { cookieName: REFRESH_COOKIE, signed: false },
    });

    // Throw UnauthorizedError -> errorHandler.plugin ánh xạ 401 (một đường duy nhất).
    //
    // CHỦ Ý: access token KHÔNG được đối chiếu `users.tokenVersion` ở đây. Thu hồi phiên
    // chỉ diễn ra lúc refresh (`loadUserForRefresh`), nên sau khi đặt lại mật khẩu, access
    // token cũ vẫn sống hết TTL (env.accessTtl). Đổi lại: không tốn 1 truy vấn DB mỗi
    // request. Hệ quả quan trọng: `req.user.tokenVersion` có thể CŨ theo thiết kế — mọi chỗ ký
    // token mới từ vé đang dùng phải đối chiếu DB trước (loadUserForReissue / loadUserForRefresh).
    app.decorate('authenticate', async (req: FastifyRequest) => {
      try {
        await req.jwtVerify();
      } catch {
        throw new UnauthorizedError(MESSAGES.AUTH.UNAUTHORIZED);
      }
    });

    // Guard phân quyền theo role. Dùng SAU authenticate (cần req.user).
    // Vd: preHandler: [app.authenticate, app.requireRole('ADMIN')]
    //
    // NẠP LẠI người dùng từ DB (vbsec 2026-09-10), khác `authenticate`: route có guard vai trò là thao tác
    // đặc quyền (quản trị hệ thống, chủ tài khoản) — vé cũ còn hạn của người vừa bị hạ quyền / khóa / đặt
    // lại mật khẩu (tăng tokenVersion) không được dùng tiếp tới hết TTL. Đổi lại 1 truy vấn mỗi request
    // của nhóm route này (ít lượt, không phải đường nóng).
    app.decorate('requireRole', (...roles: Role[]) => {
      return async (req: FastifyRequest) => {
        if (!roles.includes(req.user.role as Role)) {
          throw new ForbiddenError(MESSAGES.AUTH.FORBIDDEN);
        }
        const user = await sysPrisma.user.findUnique({
          where: { id: req.user.userId },
          select: { role: true, isActive: true, tokenVersion: true },
        });
        if (!user || !user.isActive || user.tokenVersion !== (req.user.tokenVersion ?? 0)) {
          throw new UnauthorizedError(MESSAGES.AUTH.UNAUTHORIZED);
        }
        if (!roles.includes(user.role)) {
          throw new ForbiddenError(MESSAGES.AUTH.FORBIDDEN);
        }
      };
    });
  },
  { name: 'jwt' },
);

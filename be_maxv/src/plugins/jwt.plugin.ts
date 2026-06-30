import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import type { FastifyRequest } from 'fastify';
import { env } from '../config/env';
import { UnauthorizedError, ForbiddenError } from '../helpers/errors';
import { MESSAGES } from '../constants/messages';
import { REFRESH_COOKIE } from '../constants/auth';
import type { Role } from '../generated/sys';

/**
 * Fastify plugin: cấu hình JWT (@fastify/jwt) + decorator `authenticate`.
 * - Access token: instance mặc định -> reply.jwtSign / req.jwtVerify / req.user
 * - Refresh token: namespace 'refresh' (secret riêng) -> reply.refreshJwtSign /
 *   req.refreshJwtVerify (xem types/fastify.d.ts).
 */
export default fp(
  async (app) => {
    app.register(fjwt, { secret: env.jwtAccessSecret });
    app.register(fjwt, {
      secret: env.jwtRefreshSecret,
      namespace: 'refresh',
      // refreshJwtVerify() đọc token trực tiếp từ cookie httpOnly
      cookie: { cookieName: REFRESH_COOKIE, signed: false },
    });

    // Throw UnauthorizedError -> errorHandler.plugin ánh xạ 401 (một đường duy nhất).
    app.decorate('authenticate', async (req: FastifyRequest) => {
      try {
        await req.jwtVerify();
      } catch {
        throw new UnauthorizedError(MESSAGES.AUTH.UNAUTHORIZED);
      }
    });

    // Guard phân quyền theo role. Dùng SAU authenticate (cần req.user).
    // Vd: preHandler: [app.authenticate, app.requireRole('ADMIN')]
    app.decorate('requireRole', (...roles: Role[]) => {
      return async (req: FastifyRequest) => {
        if (!roles.includes(req.user.role as Role)) {
          throw new ForbiddenError(MESSAGES.AUTH.FORBIDDEN);
        }
      };
    });
  },
  { name: 'jwt' },
);

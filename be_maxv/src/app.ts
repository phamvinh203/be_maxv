import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { env } from './config/env';
import requestContextPlugin from './plugins/requestContext.plugin';
import prismaPlugin from './plugins/prisma.plugin';
import jwtPlugin from './plugins/jwt.plugin';
import errorHandlerPlugin from './plugins/errorHandler.plugin';
import { registerRoutes } from './routes/index.route';

/**
 * Dựng Fastify app (đăng ký plugin + route) nhưng KHÔNG listen.
 * Dùng chung cho server (server.ts) và test in-process (app.inject).
 */
export async function buildApp(
  opts: { logger?: boolean } = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true, trustProxy: env.trustProxy });

  await app.register(requestContextPlugin); // ALS: lưu IP theo request (cho writeLog)
  await app.register(sensible);
  await app.register(cors, { origin: true, credentials: true }); // credentials: gửi cookie
  await app.register(cookie); // đọc/ghi cookie (refresh token httpOnly)
  await app.register(errorHandlerPlugin); // ánh xạ lỗi nghiệp vụ -> HTTP status
  await app.register(prismaPlugin); // decorate app.sysPrisma + onClose disconnect
  await app.register(jwtPlugin); // @fastify/jwt + app.authenticate
  await registerRoutes(app);

  return app;
}

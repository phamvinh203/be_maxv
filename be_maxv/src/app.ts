import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
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
  const app = Fastify({
    logger: opts.logger ?? true,
    trustProxy: env.trustProxy,
  });

  await app.register(requestContextPlugin); // ALS: lưu IP theo request (cho writeLog)
  await app.register(sensible);
  // Whitelist domain FE cụ thể (env.allowedOrigins) — KHÔNG dùng origin:true, tránh
  // phản chiếu mọi Origin kèm credentials (CORS misconfig).
  await app.register(cors, { origin: env.allowedOrigins, credentials: true });
  await app.register(cookie); // đọc/ghi cookie (refresh token httpOnly)
  // Giới hạn tốc độ mặc định toàn app; route nhạy cảm (login/register) tự siết chặt
  // hơn qua config.rateLimit riêng (xem auth.route.ts).
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  // Nhận file scan hồ sơ nhân sự (multipart). Trần 10MB khớp `GIOI_HAN_FILE_BYTE` ở
  // taiLieuDrive.service — chặn ngay tại tầng đọc request để file quá cỡ không phải nạp hết
  // vào RAM rồi mới bị từ chối.
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });
  await app.register(errorHandlerPlugin); // ánh xạ lỗi nghiệp vụ -> HTTP status
  await app.register(prismaPlugin); // decorate app.sysPrisma + onClose disconnect
  await app.register(jwtPlugin); // @fastify/jwt + app.authenticate
  await registerRoutes(app);

  return app;
}

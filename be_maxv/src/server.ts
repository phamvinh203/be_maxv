import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { env } from './config/env';
import requestContextPlugin from './plugins/requestContext.plugin';
import prismaPlugin from './plugins/prisma.plugin';
import jwtPlugin from './plugins/jwt.plugin';
import errorHandlerPlugin from './plugins/errorHandler.plugin';
import { registerRoutes } from './routes/index.route';

// trustProxy: bật khi chạy sau reverse proxy (nginx) để req.ip lấy đúng IP
// client từ X-Forwarded-For. KHÔNG bật nếu app expose trực tiếp (tránh spoof).
const app = Fastify({ logger: true, trustProxy: env.trustProxy });

async function main() {
  await app.register(requestContextPlugin); // ALS: lưu IP theo request (cho writeLog)
  await app.register(sensible);
  await app.register(cors, { origin: true, credentials: true }); // credentials: gửi cookie
  await app.register(cookie); // đọc/ghi cookie (refresh token httpOnly)
  await app.register(errorHandlerPlugin); // ánh xạ lỗi nghiệp vụ -> HTTP status
  await app.register(prismaPlugin); // decorate app.sysPrisma + onClose disconnect
  await app.register(jwtPlugin); // @fastify/jwt + app.authenticate
  await registerRoutes(app);

  await app.listen({ port: env.port, host: '0.0.0.0' });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});

async function shutdown() {
  await app.close(); // kích hoạt onClose của prisma plugin
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

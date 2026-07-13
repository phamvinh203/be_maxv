import type { FastifyInstance } from 'fastify';
import {
  register,
  login,
  me,
  refresh,
  logout,
} from '../controllers/client/auth.controller';
import { STRICT_AUTH_LIMIT } from '../constants/rateLimits';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', STRICT_AUTH_LIMIT, register);
  app.post('/login', STRICT_AUTH_LIMIT, login);
  // Bootstrap FE khi tải trang: đọc phiên từ access cookie (401 nếu chưa đăng nhập).
  app.get('/me', { preHandler: [app.authenticate] }, me);
  app.post('/refresh', refresh);
  app.post('/logout', logout);
}

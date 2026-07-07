import type { FastifyInstance } from 'fastify';
import {
  register,
  login,
  refresh,
  logout,
} from '../controllers/client/auth.controller';

// Giới hạn chặt hơn mức mặc định toàn app cho các endpoint dễ bị dò/spam.
const STRICT_AUTH_LIMIT = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } };

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', STRICT_AUTH_LIMIT, register);
  app.post('/login', STRICT_AUTH_LIMIT, login);
  app.post('/refresh', refresh);
  app.post('/logout', logout);
}

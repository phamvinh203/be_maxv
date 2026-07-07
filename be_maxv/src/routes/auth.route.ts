import type { FastifyInstance } from 'fastify';
import {
  register,
  login,
  refresh,
  logout,
} from '../controllers/client/auth.controller';
import { STRICT_AUTH_LIMIT } from '../constants/rateLimits';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', STRICT_AUTH_LIMIT, register);
  app.post('/login', STRICT_AUTH_LIMIT, login);
  app.post('/refresh', refresh);
  app.post('/logout', logout);
}

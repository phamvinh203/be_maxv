import type { FastifyInstance } from 'fastify';
import {
  register,
  login,
  refresh,
  logout,
} from '../controllers/auth.controller';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', register);
  app.post('/login', login);
  app.post('/refresh', refresh);
  app.post('/logout', logout);
}

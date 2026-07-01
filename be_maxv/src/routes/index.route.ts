import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.route';
import { companyRoutes } from './company.route';
import { nhanVienRoutes } from './nhanVien.route';
import { adminRoutes } from './admin.route';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(companyRoutes, { prefix: '/api/v1/companies' });
  await app.register(nhanVienRoutes, { prefix: '/api/v1/nhan-vien' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
}

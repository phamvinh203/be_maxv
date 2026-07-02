import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.route';
import { companyRoutes } from './company.route';
import { adminRoutes } from './admin.route';
import { tonKhoRoutes } from './tonKho/hangHoa.route';
import { dvtRoutes } from './tonKho/dvt.route';
import { phanNhomRoutes } from './tonKho/phanNhom.route';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(companyRoutes, { prefix: '/api/v1/companies' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
  await app.register(tonKhoRoutes, { prefix: '/api/v1/ton-kho' });
  await app.register(dvtRoutes, { prefix: '/api/v1/ton-kho' });
  await app.register(phanNhomRoutes, { prefix: '/api/v1/ton-kho' });
}

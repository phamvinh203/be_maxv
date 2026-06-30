import type { FastifyInstance } from 'fastify';
import {
  listCompanies,
  getCompany,
  getCompanyOverview,
  retryProvision,
  suspendCompany,
  resumeCompany,
} from '../controllers/adminCompany.controller';

/**
 * Nhóm route quản trị (control plane maxv2_sys).
 * Mọi route đều yêu cầu access token hợp lệ + role ADMIN — áp 1 lần qua hook
 * thay vì lặp preHandler ở từng route.
 */
export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.requireRole('ADMIN'));

  // Quản lý đơn vị (tenant)
  app.get('/companies', listCompanies);
  app.get('/companies/:id', getCompany);
  app.get('/companies/:id/overview', getCompanyOverview);
  app.post('/companies/:id/retry-provision', retryProvision);
  app.post('/companies/:id/suspend', suspendCompany);
  app.post('/companies/:id/resume', resumeCompany);
}

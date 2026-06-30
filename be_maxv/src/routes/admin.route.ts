import type { FastifyInstance } from 'fastify';
import {
  listCompanies,
  getCompany,
  getCompanyOverview,
  retryProvision,
  suspendCompany,
  resumeCompany,
} from '../controllers/adminCompany.controller';
import { listLogs, listLogActions } from '../controllers/adminLog.controller';
import {
  listPlans,
  createPlan,
  updatePlan,
  listSubscriptions,
  changePlan,
  cancelSubscription,
  listSubscriptionHistory,
} from '../controllers/adminSubscription.controller';
import {
  listUsers,
  activateUser,
  deactivateUser,
  changeUserRole,
  resetUserPassword,
} from '../controllers/adminUser.controller';

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

  // Nhật ký hệ thống
  app.get('/logs', listLogs);
  app.get('/logs/actions', listLogActions);

  // Gói dịch vụ
  app.get('/plans', listPlans);
  app.post('/plans', createPlan);
  app.patch('/plans/:id', updatePlan);

  // Thuê bao
  app.get('/subscriptions', listSubscriptions);
  app.post('/subscriptions/:id/change-plan', changePlan);
  app.post('/subscriptions/:id/cancel', cancelSubscription);
  app.get('/subscriptions/:id/history', listSubscriptionHistory);

  // Người dùng
  app.get('/users', listUsers);
  app.post('/users/:id/activate', activateUser);
  app.post('/users/:id/deactivate', deactivateUser);
  app.patch('/users/:id/role', changeUserRole);
  app.post('/users/:id/reset-password', resetUserPassword);
}

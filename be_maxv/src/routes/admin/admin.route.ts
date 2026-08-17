import type { FastifyInstance } from 'fastify';
import {
  listCompanies,
  getCompany,
  getCompanyOverview,
  retryProvision,
  suspendCompany,
  resumeCompany,
} from '../../controllers/admin/adminCompany.controller';
import {
  listLogs,
  listLogActions,
} from '../../controllers/admin/adminLog.controller';
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  listSubscriptions,
  changePlan,
  cancelSubscription,
  listSubscriptionHistory,
} from '../../controllers/admin/adminSubscription.controller';
import {
  listUsers,
  activateUser,
  deactivateUser,
  changeUserRole,
  resetUserPassword,
  deleteUser,
} from '../../controllers/admin/adminUser.controller';
import {
  listInvites,
  approveInvite,
  rejectInvite,
} from '../../controllers/admin/adminInvite.controller';
import {
  listOwners,
  getOwner,
} from '../../controllers/admin/adminOwner.controller';

/**
 * Nhóm route quản trị (control plane maxv2_sys).
 * Mọi route đều yêu cầu access token hợp lệ + role ADMIN — áp 1 lần qua hook
 * thay vì lặp preHandler ở từng route.
 */
export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.requireRole('ADMIN'));

  // Quản lý tài khoản (owner-centric): xem MST/DB + nhân viên của từng owner
  app.get('/owners', listOwners);
  app.get('/owners/:id', getOwner);

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
  app.delete('/plans/:id', deletePlan);

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
  // Xóa VĨNH VIỄN tài khoản — DROP luôn DB tenant của mọi MST họ sở hữu (xem adminDeleteUser).
  app.delete('/users/:id', deleteUser);

  // Lời mời nhân viên (invite_requests)
  app.get('/companies/invites', listInvites);
  app.post('/companies/invites/:id/approve', approveInvite);
  app.post('/companies/invites/:id/reject', rejectInvite);
}

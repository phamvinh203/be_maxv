import type { FastifyInstance } from 'fastify';
import {
  createCompany,
  inviteUser,
  listEmployees,
  listInvites,
} from '../controllers/client/company.controller';

export async function companyRoutes(app: FastifyInstance) {
  app.post('/', createCompany);

  // Chỉ owner đã đăng nhập và đã có công ty mới được mời user.
  app.post('/invite', {
    preHandler: [app.authenticate, app.requireRole('OWNER')],
    handler: inviteUser,
  });

  // Owner và nhân viên trong cùng công ty đều xem được danh sách đồng nghiệp.
  app.get('/employees', {
    preHandler: [app.authenticate],
    handler: listEmployees,
  });

  // Toàn bộ lời mời (mọi trạng thái) của công ty đang đăng nhập.
  app.get('/invites', {
    preHandler: [app.authenticate],
    handler: listInvites,
  });
}

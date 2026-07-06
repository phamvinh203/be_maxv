import type { FastifyInstance } from 'fastify';
import {
  createCompany,
  listCompanies,
  switchCompany,
  inviteUser,
  listEmployees,
  listInvites,
} from '../controllers/client/company.controller';

export async function companyRoutes(app: FastifyInstance) {
  // Chỉ owner đã đăng nhập mới được tạo công ty/MST (nhân viên không được).
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('OWNER')],
    handler: createCompany,
  });

  // Danh sách công ty/MST user được phép (owner thấy hết của mình; nhân viên thấy MST được cấp).
  app.get('/', {
    preHandler: [app.authenticate],
    handler: listCompanies,
  });

  // Đổi công ty đang làm việc -> cấp lại token nhúng donViId mới.
  app.post('/:id/switch', {
    preHandler: [app.authenticate],
    handler: switchCompany,
  });

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

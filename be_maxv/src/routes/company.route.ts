import type { FastifyInstance } from 'fastify';
import {
  createCompany,
  deleteCompany,
  listCompanies,
  switchCompany,
  updateCompany,
  inviteUser,
  listEmployees,
  listInvites,
  setAccess,
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

  // Owner sửa thông tin công ty của chính mình (không đổi được MST).
  app.put('/:id', {
    preHandler: [app.authenticate, app.requireRole('OWNER')],
    handler: updateCompany,
  });

  // Owner "xóa" (lưu trữ) công ty của chính mình — không xóa DB tenant.
  app.delete('/:id', {
    preHandler: [app.authenticate, app.requireRole('OWNER')],
    handler: deleteCompany,
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

  // Owner đặt lại tập MST được cấp cho 1 nhân viên (cấp/thu hồi quyền).
  app.put('/employees/:userId/access', {
    preHandler: [app.authenticate, app.requireRole('OWNER')],
    handler: setAccess,
  });
}

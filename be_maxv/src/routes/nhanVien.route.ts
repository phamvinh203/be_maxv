import type { FastifyInstance } from 'fastify';
import { createInvite, getEmployees } from '../controllers/client/nhanVien.controller';

/** Route quản lý nhân viên phía chủ đơn vị (OWNER). */
export async function nhanVienRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.requireRole('OWNER'));

  app.post('/invite', createInvite);
  app.get('/', getEmployees);
}

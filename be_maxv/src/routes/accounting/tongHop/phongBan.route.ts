import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/accounting/tongHop/danh_muc/phongBan.controller';

/**
 * Tổng hợp › Danh mục › Phòng ban (dmpb).
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function phongBanRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/phong-ban', ctrl.list);
  app.post('/phong-ban', ctrl.create);
  app.put('/phong-ban/:ma_pb', ctrl.update);
  app.delete('/phong-ban/:ma_pb', ctrl.remove);
}

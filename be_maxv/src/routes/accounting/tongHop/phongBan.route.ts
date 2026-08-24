import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/accounting/tongHop/danh_muc/phongBan.controller';
import { requireModule } from '../../../services/shared/modules.service';

/**
 * Tổng hợp › Danh mục › Phòng ban (dmpb).
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function phongBanRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireModule('accounting'));

  app.get('/phong-ban', ctrl.list);
  app.post('/phong-ban', ctrl.create);
  app.put('/phong-ban/:ma_pb', ctrl.update);
  app.delete('/phong-ban/:ma_pb', ctrl.remove);
}

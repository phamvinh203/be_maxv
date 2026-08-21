import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/accounting/tongHop/danh_muc/tienTe.controller';
import { requireModule } from '../../../services/shared/modules.service';

/**
 * Tổng hợp › Danh mục › Tiền tệ / ngoại tệ (dmnt).
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function tienTeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireModule('accounting'));

  app.get('/tien-te', ctrl.list);
  app.post('/tien-te', ctrl.create);
  app.put('/tien-te/:ma_nt', ctrl.update);
  app.delete('/tien-te/:ma_nt', ctrl.remove);
}

import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/accounting/tonKho/danh_muc/kho.controller';

/**
 * Tồn kho › Danh mục › Kho hàng (dmkho).
 * GET /kho cũng là nguồn lookup kho cho form hàng hóa.
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function khoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/kho', ctrl.list);
  app.post('/kho', ctrl.create);
  app.put('/kho/:ma_kho', ctrl.update);
  app.delete('/kho/:ma_kho', ctrl.remove);
}

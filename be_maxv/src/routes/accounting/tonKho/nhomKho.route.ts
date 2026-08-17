import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/accounting/tonKho/danh_muc/nhomKho.controller';

/**
 * Tồn kho › Danh mục › Nhóm kho hàng (dmnhkho).
 * GET /nhom-kho cũng là nguồn lookup nhóm kho cho form kho.
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function nhomKhoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/nhom-kho', ctrl.list);
  app.post('/nhom-kho', ctrl.create);
  app.put('/nhom-kho/:ma_nh', ctrl.update);
  app.delete('/nhom-kho/:ma_nh', ctrl.remove);
}

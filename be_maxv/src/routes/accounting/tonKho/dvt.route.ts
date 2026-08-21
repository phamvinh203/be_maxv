import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/accounting/tonKho/danh_muc/dvt.controller';
import { requireModule } from '../../../services/shared/modules.service';

/**
 * Tồn kho › Danh mục › Đơn vị tính (dmdvt).
 * GET /dvt cũng là nguồn lookup ĐVT cho form hàng hóa.
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function dvtRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireModule('accounting'));

  app.get('/dvt', ctrl.list);
  app.post('/dvt', ctrl.create);
  app.put('/dvt/:dvt', ctrl.update);
  app.delete('/dvt/:dvt', ctrl.remove);
}

import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/accounting/tonKho/danh_muc/thue.controller';

/**
 * Tồn kho › Danh mục › Thuế GTGT (dmthue) + Thuế nhập khẩu (dmthuenk).
 * Chỉ GET (nguồn lookup thuế cho form hàng hóa).
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function thueRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/thue', ctrl.thue);
  app.get('/thue-nk', ctrl.thueNk);
}

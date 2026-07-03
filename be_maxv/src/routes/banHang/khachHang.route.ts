import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../controllers/client/banHang/danh_muc/khachHang.controller';

/**
 * Bán hàng › Danh mục › Khách hàng (dmkh).
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function khachHangRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/khach-hang', ctrl.list);
  app.post('/khach-hang', ctrl.create);
  app.put('/khach-hang/:ma_kh', ctrl.update);
  app.delete('/khach-hang/:ma_kh', ctrl.remove);
}

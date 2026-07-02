import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../controllers/client/tonKho/danh_muc/maGd.controller';

/**
 * Tồn kho › Danh mục › Mã giao dịch (dmmagd).
 * Khóa ghép (ma_ct, ma_gd) -> URL dạng /:ma_ct/:ma_gd.
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function maGdRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/ma-gd', ctrl.list);
  app.post('/ma-gd', ctrl.create);
  app.put('/ma-gd/:ma_ct/:ma_gd', ctrl.update);
  app.delete('/ma-gd/:ma_ct/:ma_gd', ctrl.remove);
}

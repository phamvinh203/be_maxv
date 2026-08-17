import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/accounting/tonKho/danh_muc/loaiVt.controller';

/**
 * Tồn kho › Danh mục › Loại vật tư (dmloaivt).
 * GET /loai-vt cũng là nguồn lookup loại VT cho form hàng hóa.
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function loaiVtRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/loai-vt', ctrl.list);
  app.post('/loai-vt', ctrl.create);
  app.put('/loai-vt/:ma_loai_vt', ctrl.update);
  app.delete('/loai-vt/:ma_loai_vt', ctrl.remove);
}

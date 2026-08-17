import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/accounting/tonKho/danh_muc/viTriKho.controller';

/**
 * Tồn kho › Danh mục › Vị trí kho (dmvitri).
 * Khóa ghép (ma_kho, ma_vi_tri) -> URL /:ma_kho/:ma_vi_tri.
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function viTriKhoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/vi-tri-kho', ctrl.list);
  app.post('/vi-tri-kho', ctrl.create);
  app.put('/vi-tri-kho/:ma_kho/:ma_vi_tri', ctrl.update);
  app.delete('/vi-tri-kho/:ma_kho/:ma_vi_tri', ctrl.remove);
}

import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../controllers/client/tonKho/danh_muc/phanNhom.controller';

/**
 * Tồn kho › Danh mục › Phân nhóm hàng hóa, vật tư (dmnhvt).
 * Khóa ghép (loai_nh, ma_nh) -> id trên URL dạng "loai_nh-ma_nh".
 * GET /phan-nhom cũng là nguồn lookup nhóm 1/2/3 cho form hàng hóa.
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function phanNhomRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/phan-nhom', ctrl.list);
  app.post('/phan-nhom', ctrl.create);
  app.put('/phan-nhom/:id', ctrl.update);
  app.delete('/phan-nhom/:id', ctrl.remove);
}

import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../controllers/client/tongHop/danh_muc/tienTe.controller';

/**
 * Tổng hợp › Danh mục › Tiền tệ / ngoại tệ (dmnt).
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function tienTeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/tien-te', ctrl.list);
  app.post('/tien-te', ctrl.create);
  app.put('/tien-te/:ma_nt', ctrl.update);
  app.delete('/tien-te/:ma_nt', ctrl.remove);
}

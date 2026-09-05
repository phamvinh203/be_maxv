import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../controllers/client/hrm/phongBan.controller';

/**
 * HRM › Danh mục › Phòng ban (hrm_phong_ban).
 * Auth (đăng nhập, DB tenant resolve từ donViId trong JWT) + guard module `hrm` KẾ THỪA từ
 * `hrmRoutes` ở hrm.route.ts — cố ý không khai lại ở đây để chỉ có một chỗ quyết định quyền.
 */
export async function hrmPhongBanRoutes(app: FastifyInstance) {
  app.get('/phong-ban', ctrl.list);
  app.post('/phong-ban', ctrl.create);
  app.put('/phong-ban/:ma_pb', ctrl.update);
  app.delete('/phong-ban/:ma_pb', ctrl.remove);
}

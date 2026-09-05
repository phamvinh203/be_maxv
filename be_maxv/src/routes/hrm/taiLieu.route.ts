import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../controllers/client/hrm/taiLieu.controller';

/**
 * HRM › Nhân viên › Hồ sơ tài liệu (hrm_tai_lieu).
 *
 * Tài nguyên phẳng lọc theo `?ma_nv=`, cùng lý do với người phụ thuộc: dùng được cho cả tab
 * trong hồ sơ nhân viên lẫn màn tra cứu chung sau này.
 * Auth + guard module `hrm` kế thừa từ `hrmRoutes` ở hrm.route.ts.
 */
export async function hrmTaiLieuRoutes(app: FastifyInstance) {
  app.get('/tai-lieu', ctrl.list);
  app.post('/tai-lieu', ctrl.create);
  app.put('/tai-lieu/:id', ctrl.update);
  app.delete('/tai-lieu/:id', ctrl.remove);
}

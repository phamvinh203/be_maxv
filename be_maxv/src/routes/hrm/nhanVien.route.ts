import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../controllers/client/hrm/nhanVien.controller';

/**
 * HRM › Danh mục › Nhân viên (hrm_nhan_vien).
 * Auth + guard module `hrm` KẾ THỪA từ `hrmRoutes` ở hrm.route.ts — cố ý không khai lại.
 */
export async function hrmNhanVienRoutes(app: FastifyInstance) {
  app.get('/nhan-vien', ctrl.list);
  app.get('/nhan-vien/:ma_nv', ctrl.detail);
  app.post('/nhan-vien', ctrl.create);
  app.put('/nhan-vien/:ma_nv', ctrl.update);
  app.delete('/nhan-vien/:ma_nv', ctrl.remove);
}

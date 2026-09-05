import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../controllers/client/hrm/nguoiPhuThuoc.controller';

/**
 * HRM › Danh mục › Người phụ thuộc (hrm_nguoi_phu_thuoc) — giảm trừ gia cảnh TNCN.
 *
 * Tài nguyên phẳng, lọc theo `?ma_nv=` thay vì lồng dưới /nhan-vien/:ma_nv: FE dùng ở hai chỗ
 * (tab trong hồ sơ nhân viên và màn danh sách độc lập), một đường dẫn phục vụ được cả hai.
 * Auth + guard module `hrm` kế thừa từ `hrmRoutes` ở hrm.route.ts.
 */
export async function hrmNguoiPhuThuocRoutes(app: FastifyInstance) {
  app.get('/nguoi-phu-thuoc', ctrl.list);
  app.post('/nguoi-phu-thuoc', ctrl.create);
  app.put('/nguoi-phu-thuoc/:id', ctrl.update);
  app.delete('/nguoi-phu-thuoc/:id', ctrl.remove);
}

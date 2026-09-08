import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/cau_hinh_mac_dinh/holidays.controller';

/**
 * HRM › Danh mục › Lịch ngày lễ (hrm_holidays).
 * Quản lý lịch ngày nghỉ lễ và tính năng tạo nhanh 11 ngày lễ chuẩn Việt Nam.
 */
export async function hrmHolidaysRoutes(app: FastifyInstance) {
  app.post('/holidays', ctrl.create);
  app.get('/holidays', ctrl.list);
  app.post('/holidays/quick-generate', ctrl.quickGenerate);
  app.get('/holidays/:id', ctrl.detail);
  app.patch('/holidays/:id', ctrl.update);
  app.delete('/holidays/:id', ctrl.remove);
}

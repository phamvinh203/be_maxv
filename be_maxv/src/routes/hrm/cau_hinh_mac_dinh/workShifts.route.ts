import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/cau_hinh_mac_dinh/workShifts.controller';

/**
 * HRM › Danh mục › Ca làm việc (hrm_work_shifts).
 * Cung cấp danh mục ca làm việc (CA01–CA99) và các trường suy ra lúc đọc API.
 */
export async function hrmWorkShiftsRoutes(app: FastifyInstance) {
  app.post('/work-shifts', ctrl.create);
  app.get('/work-shifts', ctrl.list);
  app.get('/work-shifts/:id', ctrl.detail);
  app.patch('/work-shifts/:id', ctrl.update);
  app.delete('/work-shifts/:id', ctrl.remove);
}

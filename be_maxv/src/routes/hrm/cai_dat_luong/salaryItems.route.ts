import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/cai_dat_luong/salaryItems.controller';

/**
 * HRM › Cài đặt lương › Danh mục khoản lương & phụ cấp (hrm_salary_items).
 * Auth + guard module `hrm` kế thừa từ `hrmRoutes` ở hrm.route.ts.
 */
export async function hrmSalaryItemsRoutes(app: FastifyInstance) {
  app.get('/salary-items', ctrl.list);
  app.get('/salary-items/count-by-category', ctrl.countByCategory);
  app.get('/salary-items/:id', ctrl.detail);
  app.post('/salary-items', ctrl.create);
  app.patch('/salary-items/:id', ctrl.update);
  app.delete('/salary-items/:id', ctrl.remove);
}

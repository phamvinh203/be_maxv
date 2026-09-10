import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/cai_dat_luong/salaryStructures.controller';

/**
 * HRM › Cài đặt lương › Cấu trúc lương khung doanh nghiệp (hrm_salary_structures).
 * Auth + guard module `hrm` kế thừa từ `hrmRoutes` ở hrm.route.ts.
 */
export async function hrmSalaryStructuresRoutes(app: FastifyInstance) {
  app.get('/salary-structures/current', ctrl.current);
  app.put('/salary-structures/current', ctrl.save);
}

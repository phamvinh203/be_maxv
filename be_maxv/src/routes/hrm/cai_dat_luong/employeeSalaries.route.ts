import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/cai_dat_luong/employeeSalaries.controller';

/**
 * HRM › Cài đặt lương › Thiết lập lương nhân viên (hrm_employee_salaries).
 * Auth + guard module `hrm` kế thừa từ `hrmRoutes` ở hrm.route.ts.
 */
export async function hrmEmployeeSalariesRoutes(app: FastifyInstance) {
  app.get('/employee-salaries', ctrl.list);
  app.get('/employee-salaries/counts', ctrl.counts);
  app.get('/employee-salaries/:employeeId', ctrl.detail);
  app.put('/employee-salaries/:employeeId', ctrl.setSalary);
  app.delete('/employee-salaries/:employeeId', ctrl.remove);
  app.post('/employee-salaries/approve', ctrl.approve);
}

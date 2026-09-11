import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/cai_dat_luong/employeeSalaries.controller';
import { assertAdminOrOwner } from '../cau_hinh_mac_dinh/generalSettings.route';

/**
 * HRM › Cài đặt lương › Thiết lập lương nhân viên (hrm_employee_salaries).
 * Auth + guard module `hrm` kế thừa từ `hrmRoutes` ở hrm.route.ts.
 *
 * Quyền xem lương (`xemLuong`, kiểm ở controller) đủ để đọc và ĐẶT lương. DUYỆT thì chỉ ADMIN/OWNER
 * (`assertAdminOrOwner`, quyết định 2026-09-10): duyệt là bước kiểm soát, người đặt lương không được tự
 * duyệt — cùng guard với duyệt / khóa sổ kỳ lương (payrollPeriods.route.ts) và lưu cấu trúc lương.
 */
export async function hrmEmployeeSalariesRoutes(app: FastifyInstance) {
  app.get('/employee-salaries', ctrl.list);
  app.get('/employee-salaries/counts', ctrl.counts);
  app.get('/employee-salaries/:employeeId', ctrl.detail);
  app.put('/employee-salaries/:employeeId', ctrl.setSalary);
  app.delete('/employee-salaries/:employeeId', ctrl.remove);
  app.post(
    '/employee-salaries/approve',
    { preHandler: assertAdminOrOwner },
    ctrl.approve,
  );
}

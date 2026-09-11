import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/cai_dat_luong/salaryStructures.controller';
import { assertAdminOrOwner } from '../cau_hinh_mac_dinh/generalSettings.route';

/**
 * HRM › Cài đặt lương › Cấu trúc lương khung doanh nghiệp (hrm_salary_structures).
 * Auth + guard module `hrm` kế thừa từ `hrmRoutes` ở hrm.route.ts.
 *
 * Lưu cấu trúc CHỈ cho ADMIN/OWNER: `taxTreatment: 'EXEMPT'` biến một khoản thành miễn thuế TNCN
 * (`laKhoanMienThue`) cho cả công ty — cùng mức nhạy cảm với `isTaxable` của /salary-items (RVW-018).
 */
export async function hrmSalaryStructuresRoutes(app: FastifyInstance) {
  app.get('/salary-structures/current', ctrl.current);
  app.put(
    '/salary-structures/current',
    { preHandler: assertAdminOrOwner },
    ctrl.save,
  );
}

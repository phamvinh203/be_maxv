import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/du_lieu_tinh_luong/payrollClosing.controller';
import { assertAdminOrOwner } from '../cau_hinh_mac_dinh/generalSettings.route';
import { gioiHanTheoNguoiDung } from '../../../constants/rateLimits';

/**
 * Màn "Chốt kỳ lương" (BR-dltl-030…034). Chốt số / chốt toàn kỳ / tính lương: ai có quyền lương là làm
 * được (guard quyền lương nằm trong controller qua `dbCoQuyenLuongPayroll`). Mở chốt: chỉ ADMIN/OWNER
 * — cùng mức thẩm quyền với "Mở lại kỳ lương" (chủ dự án chốt 2026-09-11).
 */
export async function hrmPayrollClosingRoutes(app: FastifyInstance) {
  app.get('/payroll-periods/:id/closing', ctrl.overview);
  app.get('/payroll-periods/:id/activities', ctrl.activities);
  // Tính lại lương TOÀN CÔNG TY mỗi lượt bấm — giới hạn theo người dùng như 3 route tính lương ở
  // `payrollCalculation.route.ts`, không chỉ trần chung theo IP.
  app.post('/payroll-periods/:id/calculate', gioiHanTheoNguoiDung(30, '1 minute'), ctrl.calculate);
  app.post('/payroll-periods/:id/modules/lock-all', ctrl.lockAll);
  app.post('/payroll-periods/:id/modules/:module/lock', ctrl.lockModule);
  app.post(
    '/payroll-periods/:id/modules/:module/unlock',
    { preHandler: assertAdminOrOwner },
    ctrl.unlockModule,
  );
}

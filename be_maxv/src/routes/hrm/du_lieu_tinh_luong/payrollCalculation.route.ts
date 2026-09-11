import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/du_lieu_tinh_luong/payrollCalculation.controller';
import { gioiHanTheoNguoiDung } from '../../../constants/rateLimits';

export async function hrmPayrollCalculationRoutes(app: FastifyInstance) {
  // Cả 3 route tính lại lương TOÀN CÔNG TY mỗi lượt gọi (kỳ còn mở tính live) -> giới hạn theo người
  // dùng, không chỉ trần chung 300/phút/IP (vbsec 2026-09-10). 30/phút đủ rộng cho màn hình tự tải lại.
  // Gọi hàm mỗi route: @fastify/rate-limit gắn hook vào chính object option của route.
  app.get('/payroll/calculate', gioiHanTheoNguoiDung(30, '1 minute'), ctrl.calculatePreview);
  app.get('/payroll/sheet-lines', gioiHanTheoNguoiDung(30, '1 minute'), ctrl.getSheetLines);
  app.get(
    '/payroll/support-allowances',
    gioiHanTheoNguoiDung(30, '1 minute'),
    ctrl.getSupportAllowances,
  );
}

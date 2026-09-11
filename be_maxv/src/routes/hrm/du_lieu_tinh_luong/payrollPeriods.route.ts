import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/du_lieu_tinh_luong/payrollPeriods.controller';
import { assertAdminOrOwner } from '../cau_hinh_mac_dinh/generalSettings.route';

export async function hrmPayrollPeriodsRoutes(app: FastifyInstance) {
  app.get('/payroll-periods', ctrl.list);
  app.post('/payroll-periods', ctrl.create);
  app.get('/payroll-periods/:id', ctrl.detail);
  app.patch('/payroll-periods/:id', ctrl.update);
  app.delete('/payroll-periods/:id', ctrl.remove);

  // Vòng đời chuyển trạng thái
  app.post('/payroll-periods/:id/submit', ctrl.submit);
  app.post('/payroll-periods/:id/reject', ctrl.reject);

  // BR-dltl-002 / ADR-dltl-05 bước 1 / review-findings.md BUG-dltl-003+011 (2026-09-09):
  // khóa sổ (lock) / mở lại (reopen) / phê duyệt (approve) là 3 hành vi thẩm quyền tài chính —
  // trước đây chỉ có guard chung `requireModule('hrm')` nên BẤT KỲ ai vào được module `hrm`
  // cũng làm được. Dùng lại NGUYÊN hàm `assertAdminOrOwner` đã có ở "Cấu hình mặc định"
  // (đúng tiền lệ ADR-dltl-05: "ADMIN" ánh xạ sang ADMIN hoặc OWNER) — không viết guard mới.
  app.post('/payroll-periods/:id/lock', { preHandler: assertAdminOrOwner }, ctrl.lock);
  app.post('/payroll-periods/:id/reopen', { preHandler: assertAdminOrOwner }, ctrl.reopen);
  app.post('/payroll-periods/:id/approve', { preHandler: assertAdminOrOwner }, ctrl.approve);

  // vbsec 2026-09-10 / quyết định 2026-09-11: đánh dấu "đã chi lương" (APPROVED -> PAID) và lưu trữ kỳ
  // (PAID -> ARCHIVED) cũng là hành vi thẩm quyền tài chính như 3 action trên -> cùng guard.
  app.post('/payroll-periods/:id/mark-paid', { preHandler: assertAdminOrOwner }, ctrl.markPaid);
  app.post('/payroll-periods/:id/archive', { preHandler: assertAdminOrOwner }, ctrl.archive);
}

import type { FastifyRequest } from 'fastify';
import { assertXemLuong, resolveTenantCtx } from './resolveTenantDb';

/**
 * Tenant client cho TOÀN BỘ nhóm Dữ liệu tính lương (`payroll-periods`, `payroll-catalogs`,
 * `payroll-data`, `payroll`) — đã chặn sẵn theo QUYỀN XEM DỮ LIỆU LƯƠNG (BR-hrm-059, ADR-007),
 * cùng khuôn với `dbCoQuyenLuong` của `hopDong.controller.ts`.
 *
 * Sửa RVW review-findings.md 2026-09-09 (kế thừa A-01 của Architect): cả 4 controller
 * (`payrollPeriods`, `catalogs`, `payrollInputs`, `payrollCalculation`) trước đây gọi thẳng
 * `resolveTenantDb(req)` — không kiểm `xemLuong` — nên một `OWNER_EMPLOYEE` bị tắt cờ xem lương
 * vẫn đọc được toàn bộ bảng lương/TNCN công ty qua `GET /payroll/calculate`. Dùng MỘT helper
 * dùng chung cho cả 4 file thay vì chép 4 lần (tránh lặp RVW-007 đã cảnh báo).
 *
 * `OWNER` luôn qua; `OWNER_EMPLOYEE` phải có `DonViAccess.xemLuong = true`. Không có quyền
 * -> 403 `E-hrm-058` (`MESSAGES.HRM.KHONG_CO_QUYEN_XEM_LUONG`).
 */
export async function dbCoQuyenLuongPayroll(req: FastifyRequest) {
  const ctx = await resolveTenantCtx(req);
  assertXemLuong(ctx);
  return ctx.db;
}

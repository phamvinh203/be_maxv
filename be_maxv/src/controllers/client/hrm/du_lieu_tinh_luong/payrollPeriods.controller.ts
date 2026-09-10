import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentUserId } from '../../../../helpers/resolveTenantDb';
import { dbCoQuyenLuongPayroll } from '../../../../helpers/hrm/payrollAccessGuard';
import { sendCreated, sendOk } from '../../../../helpers/response';
import { validateBody, validateParams, validateQuery } from '../../../../utils/validate';
import { writeLog } from '../../../../services/shared/syslog.service';
import { z } from 'zod';
import {
  createPayrollPeriodSchema,
  listPayrollPeriodsQuerySchema,
  reopenPayrollPeriodSchema,
  updatePayrollPeriodSchema,
} from '../../../../validators/hrm/du_lieu_tinh_luong/payrollPeriods.validator';
import * as service from '../../../../services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service';

const idParamSchema = z.object({ id: z.string().trim().min(1) });

/**
 * Nhật ký kiểm toán cho 3 hành vi thẩm quyền tài chính (khóa sổ / mở lại / phê duyệt kỳ lương)
 * — BR-dltl-002, NFR-dltl-003, ADR-dltl-05 bước 2 (OQ-dltl-003).
 *
 * Sửa BUG-dltl-004 / review-findings.md 2026-09-09: trước đây `reason`/`userId` được validate
 * rồi VỨT ĐI (`_input`/`_userId`) — không có nơi nào ghi lại "ai làm gì lúc nào". Tenant schema
 * KHÔNG có bảng audit riêng cho payroll, nên tái sử dụng `writeLog` (bảng `sys_log` control
 * plane) — ĐÚNG khuôn đã dùng cho "Cấu hình mặc định" (`generalSettings.controller.ts:25-35`,
 * BR-hrm-066 nhóm 6). KHÔNG tạo bảng mới — nhất quán toàn hệ thống theo đúng yêu cầu OQ-dltl-003.
 * `writeLog` là ghi kèm-không-chặn (tự nuốt lỗi bên trong), nên nhật ký hỏng không ảnh hưởng
 * thao tác nghiệp vụ chính.
 */
async function ghiNhatKyLuong(
  req: FastifyRequest,
  hanhDong:
    | 'HRM_PAYROLL_PERIOD_LOCKED'
    | 'HRM_PAYROLL_PERIOD_REOPENED'
    | 'HRM_PAYROLL_PERIOD_APPROVED',
  periodId: string,
  extra?: Record<string, unknown>,
) {
  await writeLog({
    hanhDong,
    userId: currentUserId(req),
    donViId: req.user.donViId ?? undefined,
    chiTiet: { periodId, ...extra },
  });
}

export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(listPayrollPeriodsQuerySchema, req.query);
  return sendOk(reply, await service.listPayrollPeriods(db, q));
}

export async function detail(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await service.getPayrollPeriodById(db, id));
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(createPayrollPeriodSchema, req.body);
  return sendCreated(reply, await service.createPayrollPeriod(db, body));
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  const body = validateBody(updatePayrollPeriodSchema, req.body);
  return sendOk(reply, await service.updatePayrollPeriod(db, id, body));
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await service.deletePayrollPeriod(db, id));
}

export async function submit(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await service.submitPayrollPeriod(db, id));
}

export async function reject(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await service.rejectPayrollPeriod(db, id));
}

// RVW-002 (review-findings.md 2026-09-09): payload JWT thật là {userId, donViId, role,
// tokenVersion} (types/fastify.d.ts) — KHÔNG có claim `sub`. `(req.user as any)?.sub` luôn
// `undefined`, nên `lockedByUserId` bị ghi `null` vĩnh viễn dù cột đã có sẵn trong schema.
// Dùng `currentUserId(req)` (helpers/resolveTenantDb.ts) — cùng helper mọi module HRM khác
// đã dùng, không ép kiểu `as any`.
//
// Guard `assertAdminOrOwner` (role-guard) gắn ở TẦNG ROUTE (payrollPeriods.route.ts), không
// gắn ở đây — controller chỉ còn lo nghiệp vụ + audit.
export async function lock(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  const userId = currentUserId(req);
  const ketQua = await service.lockPayrollPeriod(db, id, userId);
  await ghiNhatKyLuong(req, 'HRM_PAYROLL_PERIOD_LOCKED', id);
  return sendOk(reply, ketQua);
}

export async function reopen(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  const body = validateBody(reopenPayrollPeriodSchema, req.body);
  const ketQua = await service.reopenPayrollPeriod(db, id);
  // BUG-dltl-004: lý do (>=20 ký tự, đã validate ở trên) PHẢI được lưu lại — trước đây bị vứt.
  await ghiNhatKyLuong(req, 'HRM_PAYROLL_PERIOD_REOPENED', id, { reason: body.reason });
  return sendOk(reply, ketQua);
}

export async function approve(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  const userId = currentUserId(req);
  const ketQua = await service.approvePayrollPeriod(db, id, userId);
  await ghiNhatKyLuong(req, 'HRM_PAYROLL_PERIOD_APPROVED', id);
  return sendOk(reply, ketQua);
}

export async function markPaid(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await service.markPaidPayrollPeriod(db, id));
}

export async function archive(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await service.archivePayrollPeriod(db, id));
}

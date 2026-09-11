import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentUserId } from '../../../../helpers/resolveTenantDb';
import { dbCoQuyenLuongPayroll } from '../../../../helpers/hrm/payrollAccessGuard';
import { sendCreated, sendOk } from '../../../../helpers/response';
import { validateBody, validateParams, validateQuery } from '../../../../utils/validate';
import { z } from 'zod';
import {
  createPayrollPeriodSchema,
  listPayrollPeriodsQuerySchema,
  reopenPayrollPeriodSchema,
  updatePayrollPeriodSchema,
} from '../../../../validators/hrm/du_lieu_tinh_luong/payrollPeriods.validator';
import * as service from '../../../../services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service';
import { HANH_DONG_KY_LUONG } from '../../../../constants/hrm/payrollActivities';
// Sửa BUG-dltl-004 / review-findings.md 2026-09-09: trước đây `reason`/`userId` được validate rồi VỨT
// ĐI — không nơi nào ghi "ai làm gì lúc nào". Khóa sổ / mở lại / duyệt nay ghi qua `ghiNhatKyKyLuong`.
import { ghiNhatKyKyLuong } from '../../../../helpers/hrm/nhatKyKyLuong';

const idParamSchema = z.object({ id: z.string().trim().min(1) });

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
  await ghiNhatKyKyLuong(req, HANH_DONG_KY_LUONG.PERIOD_LOCKED, id);
  return sendOk(reply, ketQua);
}

export async function reopen(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  const body = validateBody(reopenPayrollPeriodSchema, req.body);
  const ketQua = await service.reopenPayrollPeriod(db, id);
  // BUG-dltl-004: lý do (>=20 ký tự, đã validate ở trên) PHẢI được lưu lại — trước đây bị vứt.
  await ghiNhatKyKyLuong(req, HANH_DONG_KY_LUONG.PERIOD_REOPENED, id, { reason: body.reason });
  return sendOk(reply, ketQua);
}

export async function approve(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  const userId = currentUserId(req);
  const ketQua = await service.approvePayrollPeriod(db, id, userId);
  await ghiNhatKyKyLuong(req, HANH_DONG_KY_LUONG.PERIOD_APPROVED, id);
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

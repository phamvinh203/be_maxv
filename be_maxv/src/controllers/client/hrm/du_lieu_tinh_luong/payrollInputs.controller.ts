import type { FastifyReply, FastifyRequest } from 'fastify';
import { dbCoQuyenLuongPayroll } from '../../../../helpers/payrollAccessGuard';
import { sendCreated, sendOk } from '../../../../helpers/response';
import { validateBody, validateParams, validateQuery } from '../../../../utils/validate';
import { z } from 'zod';
import {
  applyAdjustmentsSchema,
  applyBonusSchema,
  applyCommissionSchema,
  applyKpiSchema,
  applyOvertimeSchema,
  applyPieceworkSchema,
  attendanceMatrixQuerySchema,
  cellOverrideSchema,
  listModuleDataQuerySchema,
  recordDiligenceSchema,
} from '../../../../validators/hrm/du_lieu_tinh_luong/inputs.validator';
import * as service from '../../../../services/client/hrm/du_lieu_tinh_luong/payrollInputs.service';

const idParamSchema = z.object({ id: z.string().trim().min(1) });
const maNvParamSchema = z.object({ ma_nv: z.string().trim().min(1) });
const periodIdParamSchema = z.object({ periodId: z.string().trim().min(1) });

// 1. Chấm công
export async function getAttendance(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(attendanceMatrixQuerySchema, req.query);
  return sendOk(reply, await service.getAttendanceMatrix(db, q));
}
export async function overrideCell(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(cellOverrideSchema, req.body);
  return sendOk(reply, await service.overrideAttendanceCell(db, body));
}

// 2. Tăng ca
export async function getOvertime(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(listModuleDataQuerySchema, req.query);
  return sendOk(reply, await service.getOvertimeData(db, q));
}
export async function applyOvertime(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(applyOvertimeSchema, req.body);
  return sendOk(reply, await service.applyOvertime(db, body));
}
export async function removeOvertime(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { ma_nv } = validateParams(maNvParamSchema, req.params);
  const { periodId } = validateQuery(periodIdParamSchema, req.query);
  return sendOk(reply, await service.deleteEmployeeOvertime(db, periodId, ma_nv));
}

// 3. KPI
export async function getKpi(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(listModuleDataQuerySchema, req.query);
  return sendOk(reply, await service.getKpiData(db, q));
}
export async function applyKpi(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(applyKpiSchema, req.body);
  return sendOk(reply, await service.applyKpi(db, body));
}

// 4. Thưởng
export async function getBonus(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(listModuleDataQuerySchema, req.query);
  return sendOk(reply, await service.getBonusData(db, q));
}
export async function applyBonus(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(applyBonusSchema, req.body);
  return sendOk(reply, await service.applyBonus(db, body));
}

// 5. Lương sản phẩm
export async function getPiecework(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(listModuleDataQuerySchema, req.query);
  return sendOk(reply, await service.getPieceworkData(db, q));
}
export async function applyPiecework(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(applyPieceworkSchema, req.body);
  return sendOk(reply, await service.applyPiecework(db, body));
}

// 6. Lương phần trăm
export async function getCommission(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(listModuleDataQuerySchema, req.query);
  return sendOk(reply, await service.getCommissionData(db, q));
}
export async function applyCommission(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(applyCommissionSchema, req.body);
  return sendOk(reply, await service.applyCommission(db, body));
}

// 7. Chuyên cần
export async function getDiligence(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(listModuleDataQuerySchema, req.query);
  return sendOk(reply, await service.getDiligenceData(db, q));
}
export async function recordDiligence(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(recordDiligenceSchema, req.body);
  return sendCreated(reply, await service.recordDiligenceViolation(db, body));
}
export async function removeDiligence(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await service.deleteDiligenceRecord(db, id));
}

// 8. Ứng - Bù trừ
export async function getAdjustments(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(listModuleDataQuerySchema, req.query);
  return sendOk(reply, await service.getAdjustmentsData(db, q));
}
export async function applyAdjustments(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(applyAdjustmentsSchema, req.body);
  return sendOk(reply, await service.applyAdjustments(db, body));
}

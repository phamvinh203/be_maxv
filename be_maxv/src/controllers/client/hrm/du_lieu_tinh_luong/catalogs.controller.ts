import type { FastifyReply, FastifyRequest } from 'fastify';
import { dbCoQuyenLuongPayroll } from '../../../../helpers/hrm/payrollAccessGuard';
import { sendCreated, sendOk } from '../../../../helpers/response';
import { validateBody, validateParams, validateQuery } from '../../../../utils/validate';
import { z } from 'zod';
import {
  catalogQuerySchema,
  createAdjustmentItemSchema,
  createDiligenceTypeSchema,
  createKpiItemSchema,
  createProductSchema,
  updateAdjustmentItemSchema,
  updateDiligenceTypeSchema,
  updateKpiItemSchema,
  updateProductSchema,
} from '../../../../validators/hrm/du_lieu_tinh_luong/catalogs.validator';
import * as service from '../../../../services/client/hrm/du_lieu_tinh_luong/catalogs.service';

const idParamSchema = z.object({ id: z.string().trim().min(1) });

// 1. KPI Items
export async function listKpi(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(catalogQuerySchema, req.query);
  return sendOk(reply, await service.listKpiItems(db, q));
}
export async function createKpi(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(createKpiItemSchema, req.body);
  return sendCreated(reply, await service.createKpiItem(db, body));
}
export async function updateKpi(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  const body = validateBody(updateKpiItemSchema, req.body);
  return sendOk(reply, await service.updateKpiItem(db, id, body));
}
export async function removeKpi(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await service.deleteKpiItem(db, id));
}

// 2. Products
export async function listProducts(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(catalogQuerySchema, req.query);
  return sendOk(reply, await service.listProducts(db, q));
}
export async function createProduct(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(createProductSchema, req.body);
  return sendCreated(reply, await service.createProduct(db, body));
}
export async function updateProduct(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  const body = validateBody(updateProductSchema, req.body);
  return sendOk(reply, await service.updateProduct(db, id, body));
}
export async function removeProduct(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await service.deleteProduct(db, id));
}

// 3. Diligence Types
export async function listDiligence(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(catalogQuerySchema, req.query);
  return sendOk(reply, await service.listDiligenceTypes(db, q));
}
export async function createDiligence(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(createDiligenceTypeSchema, req.body);
  return sendCreated(reply, await service.createDiligenceType(db, body));
}
export async function updateDiligence(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  const body = validateBody(updateDiligenceTypeSchema, req.body);
  return sendOk(reply, await service.updateDiligenceType(db, id, body));
}
export async function removeDiligence(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await service.deleteDiligenceType(db, id));
}

// 4. Adjustment Items
export async function listAdjustments(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const q = validateQuery(catalogQuerySchema, req.query);
  return sendOk(reply, await service.listAdjustmentItems(db, q));
}
export async function createAdjustment(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const body = validateBody(createAdjustmentItemSchema, req.body);
  return sendCreated(reply, await service.createAdjustmentItem(db, body));
}
export async function updateAdjustment(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  const body = validateBody(updateAdjustmentItemSchema, req.body);
  return sendOk(reply, await service.updateAdjustmentItem(db, id, body));
}
export async function removeAdjustment(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await service.deleteAdjustmentItem(db, id));
}

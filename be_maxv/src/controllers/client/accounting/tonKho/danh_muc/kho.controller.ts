import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../../helpers/response';
import { resolveTenantDb } from '../../../../../helpers/resolveTenantDb';
import {
  createKho,
  deleteKho,
  listKho,
  updateKho,
} from '../../../../../services/client/accounting/tonKho/danh_muc/kho.service';
import {
  khoBodySchema,
  khoListQuerySchema,
  khoParamSchema,
} from '../../../../../validators/accounting/tonKho/kho.validator';

// GET /api/v1/ton-kho/kho
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(khoListQuerySchema, req.query);
  return sendOk(reply, await listKho(db, q));
}

// POST /api/v1/ton-kho/kho
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(khoBodySchema, req.body);
  return sendCreated(reply, await createKho(db, body));
}

// PUT /api/v1/ton-kho/kho/:ma_kho
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_kho } = validateParams(khoParamSchema, req.params);
  const body = validateBody(khoBodySchema, req.body);
  return sendOk(reply, await updateKho(db, decodeURIComponent(ma_kho), body));
}

// DELETE /api/v1/ton-kho/kho/:ma_kho
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_kho } = validateParams(khoParamSchema, req.params);
  return sendOk(reply, await deleteKho(db, decodeURIComponent(ma_kho)));
}

import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../../helpers/response';
import { resolveTenantDb } from '../../../../../helpers/resolveTenantDb';
import {
  createDvt,
  deleteDvt,
  listDvt,
  updateDvt,
} from '../../../../../services/client/accounting/tonKho/danh_muc/dvt.service';
import {
  dvtBodySchema,
  dvtListQuerySchema,
  dvtParamSchema,
} from '../../../../../validators/accounting/tonKho/dvt.validator';

// GET /api/v1/ton-kho/dvt
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(dvtListQuerySchema, req.query);
  return sendOk(reply, await listDvt(db, q));
}

// POST /api/v1/ton-kho/dvt
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(dvtBodySchema, req.body);
  return sendCreated(reply, await createDvt(db, body));
}

// PUT /api/v1/ton-kho/dvt/:dvt
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { dvt } = validateParams(dvtParamSchema, req.params);
  const body = validateBody(dvtBodySchema, req.body);
  return sendOk(reply, await updateDvt(db, decodeURIComponent(dvt), body));
}

// DELETE /api/v1/ton-kho/dvt/:dvt
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { dvt } = validateParams(dvtParamSchema, req.params);
  return sendOk(reply, await deleteDvt(db, decodeURIComponent(dvt)));
}

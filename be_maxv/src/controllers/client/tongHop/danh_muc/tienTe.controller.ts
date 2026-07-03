import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../helpers/response';
import { resolveTenantDb } from '../../../../helpers/resolveTenantDb';
import {
  createTienTe,
  deleteTienTe,
  listTienTe,
  updateTienTe,
} from '../../../../services/client/tongHop/danh_muc/tienTe.service';
import {
  tienTeBodySchema,
  tienTeListQuerySchema,
  tienTeParamSchema,
  tienTeUpdateSchema,
} from '../../../../validators/tongHop/tienTe.validator';

// GET /api/v1/tong-hop/tien-te
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(tienTeListQuerySchema, req.query);
  return sendOk(reply, await listTienTe(db, q));
}

// POST /api/v1/tong-hop/tien-te
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(tienTeBodySchema, req.body);
  return sendCreated(reply, await createTienTe(db, body));
}

// PUT /api/v1/tong-hop/tien-te/:ma_nt
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_nt } = validateParams(tienTeParamSchema, req.params);
  const body = validateBody(tienTeUpdateSchema, req.body);
  return sendOk(reply, await updateTienTe(db, decodeURIComponent(ma_nt), body));
}

// DELETE /api/v1/tong-hop/tien-te/:ma_nt
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_nt } = validateParams(tienTeParamSchema, req.params);
  return sendOk(reply, await deleteTienTe(db, decodeURIComponent(ma_nt)));
}

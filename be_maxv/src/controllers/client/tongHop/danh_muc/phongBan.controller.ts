import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../helpers/response';
import { resolveTenantDb } from '../../../../helpers/resolveTenantDb';
import {
  createPhongBan,
  deletePhongBan,
  listPhongBan,
  updatePhongBan,
} from '../../../../services/client/tongHop/danh_muc/phongBan.service';
import {
  phongBanBodySchema,
  phongBanListQuerySchema,
  phongBanParamSchema,
  phongBanUpdateSchema,
} from '../../../../validators/tongHop/phongBan.validator';

// GET /api/v1/tong-hop/phong-ban
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(phongBanListQuerySchema, req.query);
  return sendOk(reply, await listPhongBan(db, q));
}

// POST /api/v1/tong-hop/phong-ban
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(phongBanBodySchema, req.body);
  return sendCreated(reply, await createPhongBan(db, body));
}

// PUT /api/v1/tong-hop/phong-ban/:ma_pb
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_pb } = validateParams(phongBanParamSchema, req.params);
  const body = validateBody(phongBanUpdateSchema, req.body);
  return sendOk(reply, await updatePhongBan(db, decodeURIComponent(ma_pb), body));
}

// DELETE /api/v1/tong-hop/phong-ban/:ma_pb
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_pb } = validateParams(phongBanParamSchema, req.params);
  return sendOk(reply, await deletePhongBan(db, decodeURIComponent(ma_pb)));
}

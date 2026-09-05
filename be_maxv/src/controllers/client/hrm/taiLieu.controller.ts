import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../utils/validate';
import { sendCreated, sendOk } from '../../../helpers/response';
import { resolveTenantDb } from '../../../helpers/resolveTenantDb';
import {
  createTaiLieu,
  deleteTaiLieu,
  listTaiLieu,
  updateTaiLieu,
} from '../../../services/client/hrm/taiLieu.service';
import {
  taiLieuBodySchema,
  taiLieuListQuerySchema,
  taiLieuParamSchema,
  taiLieuUpdateSchema,
} from '../../../validators/hrm/taiLieu.validator';

// GET /api/v1/hrm/tai-lieu?ma_nv=&loai=
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(taiLieuListQuerySchema, req.query);
  return sendOk(reply, await listTaiLieu(db, q));
}

// POST /api/v1/hrm/tai-lieu
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(taiLieuBodySchema, req.body);
  return sendCreated(reply, await createTaiLieu(db, body));
}

// PUT /api/v1/hrm/tai-lieu/:id
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(taiLieuParamSchema, req.params);
  const body = validateBody(taiLieuUpdateSchema, req.body);
  return sendOk(reply, await updateTaiLieu(db, id, body));
}

// DELETE /api/v1/hrm/tai-lieu/:id
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(taiLieuParamSchema, req.params);
  return sendOk(reply, await deleteTaiLieu(db, id));
}

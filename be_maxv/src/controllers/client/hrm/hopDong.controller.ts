import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../utils/validate';
import { sendCreated, sendOk } from '../../../helpers/response';
import { resolveTenantDb } from '../../../helpers/resolveTenantDb';
import {
  createHopDong,
  deleteHopDong,
  doiHopDong,
  listHopDong,
  updateHopDong,
} from '../../../services/client/hrm/hopDong.service';
import {
  doiHopDongBodySchema,
  hopDongBodySchema,
  hopDongListQuerySchema,
  hopDongParamSchema,
  hopDongUpdateSchema,
} from '../../../validators/hrm/hopDong.validator';

// GET /api/v1/hrm/hop-dong?ma_nv=
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(hopDongListQuerySchema, req.query);
  return sendOk(reply, await listHopDong(db, q));
}

// POST /api/v1/hrm/hop-dong
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(hopDongBodySchema, req.body);
  return sendCreated(reply, await createHopDong(db, body));
}

// POST /api/v1/hrm/hop-dong/doi — chốt HĐ cũ + ký HĐ mới trong một lần ghi
export async function doi(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(doiHopDongBodySchema, req.body);
  return sendCreated(reply, await doiHopDong(db, body));
}

// PUT /api/v1/hrm/hop-dong/:id
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(hopDongParamSchema, req.params);
  const body = validateBody(hopDongUpdateSchema, req.body);
  return sendOk(reply, await updateHopDong(db, id, body));
}

// DELETE /api/v1/hrm/hop-dong/:id
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(hopDongParamSchema, req.params);
  return sendOk(reply, await deleteHopDong(db, id));
}

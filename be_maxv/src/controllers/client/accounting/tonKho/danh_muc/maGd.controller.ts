import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../../helpers/response';
import { resolveTenantDb } from '../../../../../helpers/resolveTenantDb';
import {
  createMaGd,
  deleteMaGd,
  listMaGd,
  updateMaGd,
} from '../../../../../services/client/accounting/tonKho/danh_muc/maGd.service';
import {
  maGdBodySchema,
  maGdListQuerySchema,
  maGdParamSchema,
  maGdUpdateSchema,
} from '../../../../../validators/accounting/tonKho/maGd.validator';

// GET /api/v1/ton-kho/ma-gd
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(maGdListQuerySchema, req.query);
  return sendOk(reply, await listMaGd(db, q));
}

// POST /api/v1/ton-kho/ma-gd
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(maGdBodySchema, req.body);
  return sendCreated(reply, await createMaGd(db, body));
}

// PUT /api/v1/ton-kho/ma-gd/:ma_ct/:ma_gd
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_ct, ma_gd } = validateParams(maGdParamSchema, req.params);
  const body = validateBody(maGdUpdateSchema, req.body);
  return sendOk(
    reply,
    await updateMaGd(
      db,
      decodeURIComponent(ma_ct),
      decodeURIComponent(ma_gd),
      body,
    ),
  );
}

// DELETE /api/v1/ton-kho/ma-gd/:ma_ct/:ma_gd
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_ct, ma_gd } = validateParams(maGdParamSchema, req.params);
  return sendOk(
    reply,
    await deleteMaGd(db, decodeURIComponent(ma_ct), decodeURIComponent(ma_gd)),
  );
}

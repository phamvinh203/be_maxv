import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../helpers/response';
import { resolveTenantDb } from '../../../../helpers/resolveTenantDb';
import {
  createViTri,
  deleteViTri,
  listViTri,
  updateViTri,
} from '../../../../services/client/tonKho/danh_muc/viTriKho.service';
import {
  viTriBodySchema,
  viTriListQuerySchema,
  viTriParamSchema,
  viTriUpdateSchema,
} from '../../../../validators/tonKho/viTriKho.validator';

// GET /api/v1/ton-kho/vi-tri-kho
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(viTriListQuerySchema, req.query);
  return sendOk(reply, await listViTri(db, q));
}

// POST /api/v1/ton-kho/vi-tri-kho
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(viTriBodySchema, req.body);
  return sendCreated(reply, await createViTri(db, body));
}

// PUT /api/v1/ton-kho/vi-tri-kho/:ma_kho/:ma_vi_tri
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_kho, ma_vi_tri } = validateParams(viTriParamSchema, req.params);
  const body = validateBody(viTriUpdateSchema, req.body);
  return sendOk(
    reply,
    await updateViTri(
      db,
      decodeURIComponent(ma_kho),
      decodeURIComponent(ma_vi_tri),
      body,
    ),
  );
}

// DELETE /api/v1/ton-kho/vi-tri-kho/:ma_kho/:ma_vi_tri
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_kho, ma_vi_tri } = validateParams(viTriParamSchema, req.params);
  return sendOk(
    reply,
    await deleteViTri(
      db,
      decodeURIComponent(ma_kho),
      decodeURIComponent(ma_vi_tri),
    ),
  );
}

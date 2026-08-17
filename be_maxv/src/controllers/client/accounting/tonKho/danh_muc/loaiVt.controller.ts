import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../../helpers/response';
import { resolveTenantDb } from '../../../../../helpers/resolveTenantDb';
import {
  createLoaiVt,
  deleteLoaiVt,
  listLoaiVt,
  updateLoaiVt,
} from '../../../../../services/client/accounting/tonKho/danh_muc/loaiVt.service';
import {
  loaiVtBodySchema,
  loaiVtListQuerySchema,
  loaiVtParamSchema,
  loaiVtUpdateSchema,
} from '../../../../../validators/accounting/tonKho/loaiVt.validator';

// GET /api/v1/ton-kho/loai-vt
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(loaiVtListQuerySchema, req.query);
  return sendOk(reply, await listLoaiVt(db, q));
}

// POST /api/v1/ton-kho/loai-vt
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(loaiVtBodySchema, req.body);
  return sendCreated(reply, await createLoaiVt(db, body));
}

// PUT /api/v1/ton-kho/loai-vt/:ma_loai_vt
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_loai_vt } = validateParams(loaiVtParamSchema, req.params);
  const body = validateBody(loaiVtUpdateSchema, req.body);
  return sendOk(
    reply,
    await updateLoaiVt(db, decodeURIComponent(ma_loai_vt), body),
  );
}

// DELETE /api/v1/ton-kho/loai-vt/:ma_loai_vt
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_loai_vt } = validateParams(loaiVtParamSchema, req.params);
  return sendOk(reply, await deleteLoaiVt(db, decodeURIComponent(ma_loai_vt)));
}

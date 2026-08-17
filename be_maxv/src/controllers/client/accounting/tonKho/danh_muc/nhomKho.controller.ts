import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../../helpers/response';
import { resolveTenantDb } from '../../../../../helpers/resolveTenantDb';
import {
  createNhomKho,
  deleteNhomKho,
  listNhomKho,
  updateNhomKho,
} from '../../../../../services/client/accounting/tonKho/danh_muc/nhomKho.service';
import {
  nhomKhoBodySchema,
  nhomKhoListQuerySchema,
  nhomKhoParamSchema,
  nhomKhoUpdateSchema,
} from '../../../../../validators/accounting/tonKho/nhomKho.validator';

// GET /api/v1/ton-kho/nhom-kho
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(nhomKhoListQuerySchema, req.query);
  return sendOk(reply, await listNhomKho(db, q));
}

// POST /api/v1/ton-kho/nhom-kho
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(nhomKhoBodySchema, req.body);
  return sendCreated(reply, await createNhomKho(db, body));
}

// PUT /api/v1/ton-kho/nhom-kho/:ma_nh
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_nh } = validateParams(nhomKhoParamSchema, req.params);
  const body = validateBody(nhomKhoUpdateSchema, req.body);
  return sendOk(reply, await updateNhomKho(db, decodeURIComponent(ma_nh), body));
}

// DELETE /api/v1/ton-kho/nhom-kho/:ma_nh
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_nh } = validateParams(nhomKhoParamSchema, req.params);
  return sendOk(reply, await deleteNhomKho(db, decodeURIComponent(ma_nh)));
}

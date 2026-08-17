import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../../helpers/response';
import { resolveTenantDb } from '../../../../../helpers/resolveTenantDb';
import {
  createPhanNhom,
  deletePhanNhom,
  listPhanNhom,
  updatePhanNhom,
} from '../../../../../services/client/accounting/tonKho/danh_muc/phanNhom.service';
import {
  phanNhomBodySchema,
  phanNhomListQuerySchema,
  phanNhomParamSchema,
} from '../../../../../validators/accounting/tonKho/phanNhom.validator';

/** Tách "loai_nh-ma_nh" (ma_nh có thể chứa dấu '-' nên cắt tại dấu '-' đầu). */
function parseId(id: string): { loai_nh: number; ma_nh: string } {
  const s = decodeURIComponent(id);
  const dash = s.indexOf('-');
  return { loai_nh: Number(s.slice(0, dash)), ma_nh: s.slice(dash + 1) };
}

// GET /api/v1/ton-kho/phan-nhom
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(phanNhomListQuerySchema, req.query);
  return sendOk(reply, await listPhanNhom(db, q));
}

// POST /api/v1/ton-kho/phan-nhom
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(phanNhomBodySchema, req.body);
  return sendCreated(reply, await createPhanNhom(db, body));
}

// PUT /api/v1/ton-kho/phan-nhom/:id  (id = "loai_nh-ma_nh")
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(phanNhomParamSchema, req.params);
  const body = validateBody(phanNhomBodySchema, req.body);
  const { loai_nh, ma_nh } = parseId(id);
  return sendOk(reply, await updatePhanNhom(db, loai_nh, ma_nh, body));
}

// DELETE /api/v1/ton-kho/phan-nhom/:id
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(phanNhomParamSchema, req.params);
  const { loai_nh, ma_nh } = parseId(id);
  return sendOk(reply, await deletePhanNhom(db, loai_nh, ma_nh));
}

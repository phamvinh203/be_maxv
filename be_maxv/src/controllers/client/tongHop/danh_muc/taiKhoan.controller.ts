import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../helpers/response';
import { resolveTenantDb } from '../../../../helpers/resolveTenantDb';
import {
  createTaiKhoan,
  deleteTaiKhoan,
  listTaiKhoan,
  updateTaiKhoan,
} from '../../../../services/client/tongHop/danh_muc/taiKhoan.service';
import {
  taiKhoanBodySchema,
  taiKhoanListQuerySchema,
  taiKhoanParamSchema,
  taiKhoanUpdateSchema,
} from '../../../../validators/tongHop/taiKhoan.validator';

// GET /api/v1/tong-hop/tai-khoan
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(taiKhoanListQuerySchema, req.query);
  return sendOk(reply, await listTaiKhoan(db, q));
}

// POST /api/v1/tong-hop/tai-khoan
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(taiKhoanBodySchema, req.body);
  return sendCreated(reply, await createTaiKhoan(db, body));
}

// PUT /api/v1/tong-hop/tai-khoan/:tk
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { tk } = validateParams(taiKhoanParamSchema, req.params);
  const body = validateBody(taiKhoanUpdateSchema, req.body);
  return sendOk(reply, await updateTaiKhoan(db, decodeURIComponent(tk), body));
}

// DELETE /api/v1/tong-hop/tai-khoan/:tk
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { tk } = validateParams(taiKhoanParamSchema, req.params);
  return sendOk(reply, await deleteTaiKhoan(db, decodeURIComponent(tk)));
}

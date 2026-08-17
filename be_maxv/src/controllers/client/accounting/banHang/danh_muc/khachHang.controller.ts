import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../../helpers/response';
import { resolveTenantDb } from '../../../../../helpers/resolveTenantDb';
import {
  createKhachHang,
  deleteKhachHang,
  listKhachHang,
  updateKhachHang,
} from '../../../../../services/client/accounting/banHang/danh_muc/khachHang.service';
import {
  khachHangBodySchema,
  khachHangListQuerySchema,
  khachHangParamSchema,
  khachHangUpdateSchema,
} from '../../../../../validators/accounting/banHang/khachHang.validator';

// GET /api/v1/ban-hang/khach-hang
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(khachHangListQuerySchema, req.query);
  return sendOk(reply, await listKhachHang(db, q));
}

// POST /api/v1/ban-hang/khach-hang
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(khachHangBodySchema, req.body);
  return sendCreated(reply, await createKhachHang(db, body));
}

// PUT /api/v1/ban-hang/khach-hang/:ma_kh
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_kh } = validateParams(khachHangParamSchema, req.params);
  const body = validateBody(khachHangUpdateSchema, req.body);
  return sendOk(reply, await updateKhachHang(db, decodeURIComponent(ma_kh), body));
}

// DELETE /api/v1/ban-hang/khach-hang/:ma_kh
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_kh } = validateParams(khachHangParamSchema, req.params);
  return sendOk(reply, await deleteKhachHang(db, decodeURIComponent(ma_kh)));
}

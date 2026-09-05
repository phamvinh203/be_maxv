import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../utils/validate';
import { sendCreated, sendOk } from '../../../helpers/response';
import { resolveTenantDb } from '../../../helpers/resolveTenantDb';
import {
  createNhanVien,
  deleteNhanVien,
  getNhanVien,
  listNhanVien,
  updateNhanVien,
} from '../../../services/client/hrm/nhanVien.service';
import {
  nhanVienBodySchema,
  nhanVienListQuerySchema,
  nhanVienParamSchema,
  nhanVienUpdateSchema,
} from '../../../validators/hrm/nhanVien.validator';

// GET /api/v1/hrm/nhan-vien
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(nhanVienListQuerySchema, req.query);
  return sendOk(reply, await listNhanVien(db, q));
}

// GET /api/v1/hrm/nhan-vien/:ma_nv
export async function detail(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_nv } = validateParams(nhanVienParamSchema, req.params);
  return sendOk(reply, await getNhanVien(db, ma_nv));
}

// POST /api/v1/hrm/nhan-vien
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(nhanVienBodySchema, req.body);
  return sendCreated(reply, await createNhanVien(db, body));
}

// PUT /api/v1/hrm/nhan-vien/:ma_nv
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_nv } = validateParams(nhanVienParamSchema, req.params);
  const body = validateBody(nhanVienUpdateSchema, req.body);
  return sendOk(reply, await updateNhanVien(db, ma_nv, body));
}

// DELETE /api/v1/hrm/nhan-vien/:ma_nv
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_nv } = validateParams(nhanVienParamSchema, req.params);
  return sendOk(reply, await deleteNhanVien(db, ma_nv));
}

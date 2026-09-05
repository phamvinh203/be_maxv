import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../utils/validate';
import { sendCreated, sendOk } from '../../../helpers/response';
import { resolveTenantDb } from '../../../helpers/resolveTenantDb';
import {
  createNguoiPhuThuoc,
  deleteNguoiPhuThuoc,
  listNguoiPhuThuoc,
  updateNguoiPhuThuoc,
} from '../../../services/client/hrm/nguoiPhuThuoc.service';
import {
  nguoiPhuThuocBodySchema,
  nguoiPhuThuocListQuerySchema,
  nguoiPhuThuocParamSchema,
  nguoiPhuThuocUpdateSchema,
} from '../../../validators/hrm/nguoiPhuThuoc.validator';

// GET /api/v1/hrm/nguoi-phu-thuoc?ma_nv=&ho_ten=
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(nguoiPhuThuocListQuerySchema, req.query);
  return sendOk(reply, await listNguoiPhuThuoc(db, q));
}

// POST /api/v1/hrm/nguoi-phu-thuoc
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(nguoiPhuThuocBodySchema, req.body);
  return sendCreated(reply, await createNguoiPhuThuoc(db, body));
}

// PUT /api/v1/hrm/nguoi-phu-thuoc/:id
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(nguoiPhuThuocParamSchema, req.params);
  const body = validateBody(nguoiPhuThuocUpdateSchema, req.body);
  return sendOk(reply, await updateNguoiPhuThuoc(db, id, body));
}

// DELETE /api/v1/hrm/nguoi-phu-thuoc/:id
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(nguoiPhuThuocParamSchema, req.params);
  return sendOk(reply, await deleteNguoiPhuThuoc(db, id));
}

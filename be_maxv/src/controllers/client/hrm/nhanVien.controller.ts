import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../utils/validate';
import { sendCreated, sendOk } from '../../../helpers/response';
import { resolveTenantCtx } from '../../../helpers/resolveTenantDb';
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

/**
 * Nhóm nhân viên KHÔNG bị chặn theo quyền xem lương — chỉ bị CHE BỚT TRƯỜNG (BR-hrm-059).
 *
 * Khác hẳn nhóm hợp đồng (chặn nguyên cụm 403): hồ sơ nhân sự là dữ liệu ai vào được công ty
 * cũng phải xem được, chỉ ba trường tài khoản ngân hàng mới thuộc phạm vi che. Cờ đi kèm cả
 * đường GHI vì người không có quyền đọc thì không có sẵn giá trị cũ để gửi lại (contract 3.1c).
 */

// GET /api/v1/hrm/nhan-vien
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const { db, xemLuong } = await resolveTenantCtx(req);
  const q = validateQuery(nhanVienListQuerySchema, req.query);
  return sendOk(reply, await listNhanVien(db, q, xemLuong));
}

// GET /api/v1/hrm/nhan-vien/:ma_nv
export async function detail(req: FastifyRequest, reply: FastifyReply) {
  const { db, xemLuong } = await resolveTenantCtx(req);
  const { ma_nv } = validateParams(nhanVienParamSchema, req.params);
  return sendOk(reply, await getNhanVien(db, ma_nv, xemLuong));
}

// POST /api/v1/hrm/nhan-vien
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const { db, xemLuong } = await resolveTenantCtx(req);
  const body = validateBody(nhanVienBodySchema, req.body);
  return sendCreated(reply, await createNhanVien(db, body, xemLuong));
}

// PUT /api/v1/hrm/nhan-vien/:ma_nv
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { db, xemLuong } = await resolveTenantCtx(req);
  const { ma_nv } = validateParams(nhanVienParamSchema, req.params);
  const body = validateBody(nhanVienUpdateSchema, req.body);
  return sendOk(reply, await updateNhanVien(db, ma_nv, body, xemLuong));
}

// DELETE /api/v1/hrm/nhan-vien/:ma_nv
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { db } = await resolveTenantCtx(req);
  const { ma_nv } = validateParams(nhanVienParamSchema, req.params);
  return sendOk(reply, await deleteNhanVien(db, ma_nv));
}

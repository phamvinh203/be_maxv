import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../helpers/response';
import {
  assertXemLuong,
  resolveTenantCtx,
} from '../../../../helpers/resolveTenantDb';
import {
  createHopDong,
  deleteHopDong,
  doiHopDong,
  listHopDong,
  updateHopDong,
} from '../../../../services/client/hrm/du_lieu_ca_nhan/hopDong.service';
import {
  doiHopDongBodySchema,
  hopDongBodySchema,
  hopDongListQuerySchema,
  hopDongParamSchema,
  hopDongUpdateSchema,
} from '../../../../validators/hrm/du_lieu_ca_nhan/hopDong.validator';

/**
 * Tenant client cho nhóm hợp đồng — đã chặn sẵn theo QUYỀN XEM DỮ LIỆU LƯƠNG.
 *
 * Dữ liệu lương nằm trọn trong nhóm này (BR-hrm-059, QĐ #8), nên guard đặt ở MỘT chỗ cho
 * cả năm đường: thêm endpoint mới mà quên guard là hở lại đúng lỗ BUG-HRM-25 vừa vá.
 * Không có quyền -> 403 E-hrm-058.
 */
async function dbCoQuyenLuong(req: FastifyRequest) {
  const ctx = await resolveTenantCtx(req);
  assertXemLuong(ctx);
  return ctx.db;
}

// GET /api/v1/hrm/hop-dong?ma_nv= — `ma_nv` BẮT BUỘC (QĐ #8, FR-hrm-013)
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuong(req);
  const q = validateQuery(hopDongListQuerySchema, req.query);
  return sendOk(reply, await listHopDong(db, q));
}

// POST /api/v1/hrm/hop-dong
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuong(req);
  const body = validateBody(hopDongBodySchema, req.body);
  return sendCreated(reply, await createHopDong(db, body));
}

// POST /api/v1/hrm/hop-dong/doi — chốt HĐ cũ + ký HĐ mới trong một lần ghi
export async function doi(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuong(req);
  const body = validateBody(doiHopDongBodySchema, req.body);
  return sendCreated(reply, await doiHopDong(db, body));
}

// PUT /api/v1/hrm/hop-dong/:id
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuong(req);
  const { id } = validateParams(hopDongParamSchema, req.params);
  const body = validateBody(hopDongUpdateSchema, req.body);
  return sendOk(reply, await updateHopDong(db, id, body));
}

// DELETE /api/v1/hrm/hop-dong/:id
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuong(req);
  const { id } = validateParams(hopDongParamSchema, req.params);
  return sendOk(reply, await deleteHopDong(db, id));
}

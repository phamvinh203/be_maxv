import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../helpers/response';
import {
  currentUserId,
  resolveTenantDb,
} from '../../../../helpers/resolveTenantDb';
import {
  createHangHoa,
  deleteHangHoa,
  doiMaHangHoa,
  getHangHoa,
  listHangHoa,
  updateHangHoa,
} from '../../../../services/client/tonKho/danh_muc/hangHoa.service';
import {
  listKho,
  listLoaiVt,
  listThue,
  listThueNk,
} from '../../../../services/client/tonKho/danh_muc/lookup.service';
import {
  doiMaSchema,
  hangHoaBodySchema,
  hangHoaListQuerySchema,
  maVtParamSchema,
} from '../../../../validators/tonKho/hangHoa.validator';

// ---------- Hàng hóa (dmvt) ----------

// GET /api/v1/ton-kho/hang-hoa
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(hangHoaListQuerySchema, req.query);
  const result = await listHangHoa(db, q);
  return sendOk(reply, result); // { data, total, page, limit }
}

// GET /api/v1/ton-kho/hang-hoa/:ma_vt
export async function getOne(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_vt } = validateParams(maVtParamSchema, req.params);
  const data = await getHangHoa(db, decodeURIComponent(ma_vt));
  return sendOk(reply, data);
}

// POST /api/v1/ton-kho/hang-hoa
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(hangHoaBodySchema, req.body);
  const data = await createHangHoa(db, body, currentUserId(req));
  return sendCreated(reply, data);
}

// PUT /api/v1/ton-kho/hang-hoa/:ma_vt
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_vt } = validateParams(maVtParamSchema, req.params);
  const body = validateBody(hangHoaBodySchema, req.body);
  const data = await updateHangHoa(
    db,
    decodeURIComponent(ma_vt),
    body,
    currentUserId(req),
  );
  return sendOk(reply, data);
}

// DELETE /api/v1/ton-kho/hang-hoa/:ma_vt
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { ma_vt } = validateParams(maVtParamSchema, req.params);
  const data = await deleteHangHoa(db, decodeURIComponent(ma_vt));
  return sendOk(reply, data);
}

// PUT /api/v1/ton-kho/hang-hoa/doi-ma
export async function doiMa(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(doiMaSchema, req.body);
  const data = await doiMaHangHoa(db, body);
  return sendOk(reply, data);
}

// ---------- Lookup danh mục cho form hàng hóa ----------

// GET /api/v1/ton-kho/loai-vt
export async function loaiVt(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  return sendOk(reply, await listLoaiVt(db));
}

// GET /api/v1/ton-kho/kho
export async function kho(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  return sendOk(reply, await listKho(db));
}

// GET /api/v1/ton-kho/thue
export async function thue(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  return sendOk(reply, await listThue(db));
}

// GET /api/v1/ton-kho/thue-nk
export async function thueNk(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  return sendOk(reply, await listThueNk(db));
}

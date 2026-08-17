import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../../helpers/response';
import {
  resolveTenantDb,
  currentUserId,
} from '../../../../../helpers/resolveTenantDb';
import {
  createHoaDon,
  deleteHoaDon,
  getChiTietHoaDon,
  listHoaDon,
  nextSoCt,
  updateHoaDon,
} from '../../../../../services/client/accounting/banHang/chung_tu/hoaDonBanHang.service';
import {
  hoaDonBodySchema,
  hoaDonListQuerySchema,
  hoaDonParamSchema,
} from '../../../../../validators/accounting/banHang/hoaDonBanHang.validator';

// GET /api/v1/ban-hang/hoa-don-ban-hang
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(hoaDonListQuerySchema, req.query);
  return sendOk(reply, await listHoaDon(db, q));
}

// POST /api/v1/ban-hang/hoa-don-ban-hang
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(hoaDonBodySchema, req.body);
  return sendCreated(reply, await createHoaDon(db, body, currentUserId(req)));
}

// GET /api/v1/ban-hang/hoa-don-ban-hang/next-so-ct
export async function getNextSoCt(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const so_ct = await nextSoCt(db);
  return sendOk(reply, { so_ct });
}

// GET /api/v1/ban-hang/hoa-don-ban-hang/:stt_rec/chi-tiet
export async function chiTiet(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { stt_rec } = validateParams(hoaDonParamSchema, req.params);
  return sendOk(reply, await getChiTietHoaDon(db, stt_rec));
}

// PUT /api/v1/ban-hang/hoa-don-ban-hang/:stt_rec
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { stt_rec } = validateParams(hoaDonParamSchema, req.params);
  const body = validateBody(hoaDonBodySchema, req.body);
  return sendOk(reply, await updateHoaDon(db, stt_rec, body, currentUserId(req)));
}

// DELETE /api/v1/ban-hang/hoa-don-ban-hang/:stt_rec
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { stt_rec } = validateParams(hoaDonParamSchema, req.params);
  return sendOk(reply, await deleteHoaDon(db, stt_rec));
}

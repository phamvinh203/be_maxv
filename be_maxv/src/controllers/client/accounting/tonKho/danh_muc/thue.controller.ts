import type { FastifyRequest, FastifyReply } from 'fastify';
import { validateQuery } from '../../../../../utils/validate';
import { sendOk } from '../../../../../helpers/response';
import { resolveTenantDb } from '../../../../../helpers/resolveTenantDb';
import {
  listThue,
  listThueNk,
} from '../../../../../services/client/accounting/tonKho/danh_muc/thue.service';
import { thueListQuerySchema } from '../../../../../validators/accounting/tonKho/thue.validator';

// GET /api/v1/ton-kho/thue
export async function thue(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(thueListQuerySchema, req.query);
  return sendOk(reply, await listThue(db, q));
}

// GET /api/v1/ton-kho/thue-nk
export async function thueNk(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const q = validateQuery(thueListQuerySchema, req.query);
  return sendOk(reply, await listThueNk(db, q));
}

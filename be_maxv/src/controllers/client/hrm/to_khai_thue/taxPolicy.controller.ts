import type { FastifyReply, FastifyRequest } from 'fastify';
import { dbToKhaiThue } from '../../../../helpers/hrm/toKhaiThueAccess';
import { sendOk } from '../../../../helpers/response';
import { getTaxPolicies } from '../../../../services/client/hrm/to_khai_thue/taxPolicy.service';

/** Chính sách thuế theo mốc hiệu lực — 1 endpoint chỉ đọc (api-contract Mục 6, ADR-012). */

export async function listTaxPolicies(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await dbToKhaiThue(req);
  return sendOk(reply, await getTaxPolicies(db));
}

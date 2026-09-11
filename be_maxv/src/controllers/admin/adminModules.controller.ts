import type { FastifyRequest, FastifyReply } from 'fastify';
import { MODULES } from '../../constants/modules';
import { sendOk } from '../../helpers/response';

/** GET /api/v1/admin/modules — danh mục module, admin suy ra cột/ô tick từ đây. */
export async function listModules(_req: FastifyRequest, reply: FastifyReply) {
  return sendOk(reply, MODULES);
}

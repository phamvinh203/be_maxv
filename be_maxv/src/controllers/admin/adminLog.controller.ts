import type { FastifyRequest, FastifyReply } from 'fastify';
import { listLogsQuerySchema } from '../../validators/admin.validator';
import {
  adminListLogs,
  adminListLogActions,
} from '../../services/admin/adminLog.service';
import { validateQuery } from '../../utils/validate';
import { sendOk } from '../../helpers/response';

/** GET /api/v1/admin/logs — nhật ký hệ thống + bộ lọc. */
export async function listLogs(req: FastifyRequest, reply: FastifyReply) {
  const query = validateQuery(listLogsQuerySchema, req.query);
  return sendOk(reply, await adminListLogs(query));
}

/** GET /api/v1/admin/logs/actions — danh sách hành động distinct cho dropdown. */
export async function listLogActions(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  return sendOk(reply, await adminListLogActions());
}

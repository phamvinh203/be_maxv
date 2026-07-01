import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  idParamSchema,
  listInvitesQuerySchema,
  rejectInviteSchema,
} from '../../validators/admin.validator';
import {
  adminListInvites,
  adminApproveInvite,
  adminRejectInvite,
} from '../../services/admin/adminInvite.service';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../utils/validate';
import { sendOk } from '../../helpers/response';

/** GET /api/v1/admin/invites */
export async function listInvites(req: FastifyRequest, reply: FastifyReply) {
  const query = validateQuery(listInvitesQuerySchema, req.query);
  return sendOk(reply, await adminListInvites(query));
}

/** POST /api/v1/admin/invites/:id/approve */
export async function approveInvite(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminApproveInvite(id, req.user.userId));
}

/** POST /api/v1/admin/invites/:id/reject */
export async function rejectInvite(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  const body = validateBody(rejectInviteSchema, req.body);
  return sendOk(reply, await adminRejectInvite(id, req.user.userId, body));
}

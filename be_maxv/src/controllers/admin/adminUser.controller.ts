import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  idParamSchema,
  listUsersQuerySchema,
  changeRoleSchema,
} from '../../validators/admin.validator';
import {
  adminListUsers,
  adminSetUserActive,
  adminChangeUserRole,
  adminResetPassword,
} from '../../services/admin/adminUser.service';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../utils/validate';
import { sendOk } from '../../helpers/response';

/** GET /api/v1/admin/users */
export async function listUsers(req: FastifyRequest, reply: FastifyReply) {
  const query = validateQuery(listUsersQuerySchema, req.query);
  return sendOk(reply, await adminListUsers(query));
}

/** POST /api/v1/admin/users/:id/activate */
export async function activateUser(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminSetUserActive(id, true, req.user.userId));
}

/** POST /api/v1/admin/users/:id/deactivate */
export async function deactivateUser(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminSetUserActive(id, false, req.user.userId));
}

/** PATCH /api/v1/admin/users/:id/role */
export async function changeUserRole(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  const { role } = validateBody(changeRoleSchema, req.body);
  return sendOk(reply, await adminChangeUserRole(id, role, req.user.userId));
}

/** POST /api/v1/admin/users/:id/reset-password */
export async function resetUserPassword(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminResetPassword(id, req.user.userId));
}

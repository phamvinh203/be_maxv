import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  idParamSchema,
  listOwnersQuerySchema,
  setOwnerLimitsSchema,
} from '../../validators/admin.validator';
import {
  adminListOwners,
  adminGetOwner,
  adminSetOwnerLimits,
} from '../../services/admin/adminOwner.service';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../utils/validate';
import { sendOk } from '../../helpers/response';

/** GET /api/v1/admin/owners */
export async function listOwners(req: FastifyRequest, reply: FastifyReply) {
  const query = validateQuery(listOwnersQuerySchema, req.query);
  return sendOk(reply, await adminListOwners(query));
}

/** GET /api/v1/admin/owners/:id */
export async function getOwner(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminGetOwner(id));
}

/** PATCH /api/v1/admin/owners/:id/limits */
export async function setOwnerLimits(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  const input = validateBody(setOwnerLimitsSchema, req.body);
  return sendOk(reply, await adminSetOwnerLimits(id, input, req.user.userId));
}

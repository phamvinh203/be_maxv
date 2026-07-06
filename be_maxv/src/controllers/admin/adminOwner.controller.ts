import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  idParamSchema,
  listOwnersQuerySchema,
} from '../../validators/admin.validator';
import {
  adminListOwners,
  adminGetOwner,
} from '../../services/admin/adminOwner.service';
import { validateQuery, validateParams } from '../../utils/validate';
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

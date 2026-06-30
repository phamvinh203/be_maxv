import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  idParamSchema,
  createPlanSchema,
  updatePlanSchema,
  listSubscriptionsQuerySchema,
  changePlanSchema,
} from '../../validators/admin.validator';
import {
  adminListPlans,
  adminCreatePlan,
  adminUpdatePlan,
  adminListSubscriptions,
  adminChangePlan,
  adminCancelSubscription,
  adminListSubscriptionHistory,
} from '../../services/admin/adminSubscription.service';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../utils/validate';
import { sendOk, sendCreated } from '../../helpers/response';

// ---- Gói dịch vụ ----

/** GET /api/v1/admin/plans */
export async function listPlans(_req: FastifyRequest, reply: FastifyReply) {
  return sendOk(reply, await adminListPlans());
}

/** POST /api/v1/admin/plans */
export async function createPlan(req: FastifyRequest, reply: FastifyReply) {
  const data = await adminCreatePlan(validateBody(createPlanSchema, req.body));
  return sendCreated(reply, data);
}

/** PATCH /api/v1/admin/plans/:id */
export async function updatePlan(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  const data = await adminUpdatePlan(
    id,
    validateBody(updatePlanSchema, req.body),
  );
  return sendOk(reply, data);
}

// ---- Thuê bao ----

/** GET /api/v1/admin/subscriptions */
export async function listSubscriptions(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const query = validateQuery(listSubscriptionsQuerySchema, req.query);
  return sendOk(reply, await adminListSubscriptions(query));
}

/** POST /api/v1/admin/subscriptions/:id/change-plan */
export async function changePlan(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  const body = validateBody(changePlanSchema, req.body);
  return sendOk(reply, await adminChangePlan(id, body, req.user.userId));
}

/** POST /api/v1/admin/subscriptions/:id/cancel */
export async function cancelSubscription(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminCancelSubscription(id, req.user.userId));
}

/** GET /api/v1/admin/subscriptions/:id/history */
export async function listSubscriptionHistory(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminListSubscriptionHistory(id));
}

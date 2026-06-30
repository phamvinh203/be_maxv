import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  idParamSchema,
  listCompaniesQuerySchema,
} from '../validators/admin.validator';
import {
  adminListCompanies,
  adminGetCompany,
  adminGetCompanyOverview,
  adminRetryProvision,
  adminSuspendCompany,
  adminResumeCompany,
} from '../services/adminCompany.service';
import { validateQuery, validateParams } from '../utils/validate';
import { sendOk } from '../helpers/response';

/** GET /api/v1/admin/companies */
export async function listCompanies(req: FastifyRequest, reply: FastifyReply) {
  const query = validateQuery(listCompaniesQuerySchema, req.query);
  return sendOk(reply, await adminListCompanies(query));
}

/** GET /api/v1/admin/companies/:id */
export async function getCompany(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminGetCompany(id));
}

/** GET /api/v1/admin/companies/:id/overview — tổng quan dữ liệu DB tenant */
export async function getCompanyOverview(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminGetCompanyOverview(id, req.user.userId));
}

/** POST /api/v1/admin/companies/:id/retry-provision */
export async function retryProvision(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminRetryProvision(id, req.user.userId));
}

/** POST /api/v1/admin/companies/:id/suspend */
export async function suspendCompany(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminSuspendCompany(id, req.user.userId));
}

/** POST /api/v1/admin/companies/:id/resume */
export async function resumeCompany(req: FastifyRequest, reply: FastifyReply) {
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await adminResumeCompany(id, req.user.userId));
}

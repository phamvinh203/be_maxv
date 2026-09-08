import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../helpers/response';
import { resolveTenantDb } from '../../../../helpers/resolveTenantDb';
import {
  createWorkShift,
  deleteWorkShift,
  getWorkShiftDetail,
  listWorkShifts,
  updateWorkShift,
} from '../../../../services/client/hrm/cau_hinh_mac_dinh/workShifts.service';
import {
  createWorkShiftSchema,
  updateWorkShiftSchema,
  workShiftListQuerySchema,
  workShiftParamSchema,
} from '../../../../validators/hrm/cau_hinh_mac_dinh/workShifts.validator';

// POST /api/v1/hrm/work-shifts
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(createWorkShiftSchema, req.body);
  return sendCreated(reply, await createWorkShift(db, body));
}

// GET /api/v1/hrm/work-shifts
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const query = validateQuery(workShiftListQuerySchema, req.query);
  return sendOk(reply, await listWorkShifts(db, query));
}

// GET /api/v1/hrm/work-shifts/:id
export async function detail(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(workShiftParamSchema, req.params);
  return sendOk(reply, await getWorkShiftDetail(db, id));
}

// PATCH /api/v1/hrm/work-shifts/:id
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(workShiftParamSchema, req.params);
  const body = validateBody(updateWorkShiftSchema, req.body);
  return sendOk(reply, await updateWorkShift(db, id, body));
}

// DELETE /api/v1/hrm/work-shifts/:id
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(workShiftParamSchema, req.params);
  return sendOk(reply, await deleteWorkShift(db, id));
}

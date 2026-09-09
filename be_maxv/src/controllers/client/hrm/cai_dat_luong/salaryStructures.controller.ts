import type { FastifyReply, FastifyRequest } from 'fastify';
import { resolveTenantDb } from '../../../../helpers/resolveTenantDb';
import { sendOk } from '../../../../helpers/response';
import {
  getCurrentSalaryStructure,
  saveSalaryStructure,
} from '../../../../services/client/hrm/cai_dat_luong/salaryStructures.service';
import { validateBody } from '../../../../utils/validate';
import { saveSalaryStructureSchema } from '../../../../validators/hrm/cai_dat_luong/salaryStructures.validator';

// GET /api/v1/hrm/salary-structures/current
export async function current(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  return sendOk(reply, await getCurrentSalaryStructure(db));
}

// PUT /api/v1/hrm/salary-structures/current
export async function save(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(saveSalaryStructureSchema, req.body);
  return sendOk(reply, await saveSalaryStructure(db, body));
}

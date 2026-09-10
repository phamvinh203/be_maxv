import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { resolveTenantDb } from '../../../../helpers/resolveTenantDb';
import { sendOk } from '../../../../helpers/response';
import {
  approveEmployeeSalaries,
  countEmployeeSalaries,
  deleteEmployeeSalary,
  getEmployeeSalary,
  listEmployeeSalaries,
  setEmployeeSalary,
} from '../../../../services/client/hrm/cai_dat_luong/employeeSalaries.service';
import { validateBody, validateParams, validateQuery } from '../../../../utils/validate';
import {
  approveSalariesSchema,
  employeeSalaryListQuerySchema,
  setEmployeeSalarySchema,
} from '../../../../validators/hrm/cai_dat_luong/employeeSalaries.validator';

const employeeIdParamSchema = z.object({
  employeeId: z.string().trim().min(1),
});

// GET /api/v1/hrm/employee-salaries
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const query = validateQuery(employeeSalaryListQuerySchema, req.query);
  return sendOk(reply, await listEmployeeSalaries(db, query));
}

// GET /api/v1/hrm/employee-salaries/counts
export async function counts(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  return sendOk(reply, await countEmployeeSalaries(db));
}

// GET /api/v1/hrm/employee-salaries/:employeeId
export async function detail(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { employeeId } = validateParams(employeeIdParamSchema, req.params);
  return sendOk(reply, await getEmployeeSalary(db, employeeId));
}

// PUT /api/v1/hrm/employee-salaries/:employeeId
export async function setSalary(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { employeeId } = validateParams(employeeIdParamSchema, req.params);
  const body = validateBody(setEmployeeSalarySchema, req.body);
  const userId = req.user?.userId;
  return sendOk(reply, await setEmployeeSalary(db, employeeId, body, userId));
}

// DELETE /api/v1/hrm/employee-salaries/:employeeId
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { employeeId } = validateParams(employeeIdParamSchema, req.params);
  await deleteEmployeeSalary(db, employeeId);
  return sendOk(reply, { message: 'Đã xóa thiết lập lương của nhân viên.' });
}

// POST /api/v1/hrm/employee-salaries/approve
export async function approve(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(approveSalariesSchema, req.body ?? {});
  const userId = req.user?.userId;
  return sendOk(reply, await approveEmployeeSalaries(db, body, userId));
}

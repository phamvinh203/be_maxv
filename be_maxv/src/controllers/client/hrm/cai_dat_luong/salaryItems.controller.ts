import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { resolveTenantDb } from '../../../../helpers/resolveTenantDb';
import { sendCreated, sendOk } from '../../../../helpers/response';
import {
  countSalaryItemsByCategory,
  createSalaryItem,
  deleteSalaryItem,
  getSalaryItemById,
  listSalaryItems,
  updateSalaryItem,
} from '../../../../services/client/hrm/cai_dat_luong/salaryItems.service';
import { validateBody, validateParams, validateQuery } from '../../../../utils/validate';
import {
  createSalaryItemSchema,
  salaryItemListQuerySchema,
  updateSalaryItemSchema,
} from '../../../../validators/hrm/cai_dat_luong/salaryItems.validator';

const idParamSchema = z.object({
  id: z.string().trim().min(1),
});

// GET /api/v1/hrm/salary-items
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const query = validateQuery(salaryItemListQuerySchema, req.query);
  return sendOk(reply, await listSalaryItems(db, query));
}

// GET /api/v1/hrm/salary-items/count-by-category
export async function countByCategory(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  return sendOk(reply, await countSalaryItemsByCategory(db));
}

// GET /api/v1/hrm/salary-items/:id
export async function detail(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(idParamSchema, req.params);
  return sendOk(reply, await getSalaryItemById(db, id));
}

// POST /api/v1/hrm/salary-items
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(createSalaryItemSchema, req.body);
  return sendCreated(reply, await createSalaryItem(db, body));
}

// PATCH /api/v1/hrm/salary-items/:id
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(idParamSchema, req.params);
  const body = validateBody(updateSalaryItemSchema, req.body);
  return sendOk(reply, await updateSalaryItem(db, id, body));
}

// DELETE /api/v1/hrm/salary-items/:id
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(idParamSchema, req.params);
  await deleteSalaryItem(db, id);
  return sendOk(reply, { message: 'Đã xóa khoản lương thành công.' });
}

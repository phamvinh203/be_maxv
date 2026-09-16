import type { FastifyReply, FastifyRequest } from 'fastify';
import { dbToKhaiThue } from '../../../../helpers/hrm/toKhaiThueAccess';
import { currentUserId } from '../../../../helpers/resolveTenantDb';
import { kiemTraTkt } from '../../../../helpers/hrm/toKhaiThueValidate';
import { sendCreated, sendOk } from '../../../../helpers/response';
import * as service from '../../../../services/client/hrm/to_khai_thue/otherIncomeRecord.service';
import {
  createOtherIncomeBodySchema,
  listOtherIncomeQuerySchema,
  otherIncomeIdParamsSchema,
  previewOtherIncomeBodySchema,
  updateOtherIncomeBodySchema,
} from '../../../../validators/hrm/to_khai_thue/otherIncomeRecord.validator';

/** Bản ghi thu nhập ngoài lương — 6 endpoint (api-contract Mục 3). */

export async function listOtherIncomes(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await dbToKhaiThue(req);
  const query = kiemTraTkt(listOtherIncomeQuerySchema, req.query, 'E-tkt-004');
  const kq = await service.listOtherIncomes(db, query);
  // `X-Total-Count` để giao diện dựng phân trang mà không phải đếm lại (hợp đồng Mục 0.4).
  reply.header('X-Total-Count', String(kq.totalCount));
  return sendOk(reply, {
    records: kq.records,
    summary: kq.summary,
    periodLocked: kq.periodLocked,
  });
}

export async function getOtherIncomeById(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await dbToKhaiThue(req);
  const { id } = kiemTraTkt(otherIncomeIdParamsSchema, req.params, 'E-tkt-016');
  return sendOk(reply, await service.getOtherIncomeById(db, id));
}

export async function previewOtherIncome(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await dbToKhaiThue(req);
  const body = kiemTraTkt(previewOtherIncomeBodySchema, req.body, 'E-tkt-004');
  // Tính thử, KHÔNG ghi gì. Đây là đường để giao diện thôi tự tính thuế (NFR-tkt-004).
  return sendOk(reply, await service.previewOtherIncome(db, body));
}

export async function createOtherIncome(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await dbToKhaiThue(req);
  const body = kiemTraTkt(createOtherIncomeBodySchema, req.body, 'E-tkt-004');
  const data = await service.createOtherIncome(db, {
    ...body,
    createdByUserId: currentUserId(req),
  });
  return sendCreated(reply, data);
}

export async function updateOtherIncome(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await dbToKhaiThue(req);
  const { id } = kiemTraTkt(otherIncomeIdParamsSchema, req.params, 'E-tkt-016');
  const body = kiemTraTkt(updateOtherIncomeBodySchema, req.body, 'E-tkt-004');
  return sendOk(reply, await service.updateOtherIncome(db, id, body));
}

export async function deleteOtherIncome(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await dbToKhaiThue(req);
  const { id } = kiemTraTkt(otherIncomeIdParamsSchema, req.params, 'E-tkt-016');
  await service.deleteOtherIncome(db, id);
  return reply.status(204).send();
}

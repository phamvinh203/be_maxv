import type { FastifyReply, FastifyRequest } from 'fastify';
import { dbToKhaiThue } from '../../../../helpers/hrm/toKhaiThueAccess';
import { kiemTraTkt } from '../../../../helpers/hrm/toKhaiThueValidate';
import { sendCreated, sendOk } from '../../../../helpers/response';
import * as service from '../../../../services/client/hrm/to_khai_thue/incomeCategory.service';
import {
  createIncomeCategoryBodySchema,
  incomeCategoryIdParamsSchema,
  listIncomeCategoryQuerySchema,
  updateIncomeCategoryBodySchema,
} from '../../../../validators/hrm/to_khai_thue/incomeCategory.validator';

/**
 * Danh mục loại thu nhập ngoài lương — 5 endpoint (api-contract Mục 2).
 *
 * Mọi handler đi qua `dbToKhaiThue` (hợp đồng Mục 0.1). Lỗi kiểm đầu vào đi qua
 * `kiemTraTkt` để mang mã `E-tkt-*` thay vì hình dạng `ValidationError` không có `code`.
 */

export async function listIncomeCategories(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await dbToKhaiThue(req);
  const query = kiemTraTkt(
    listIncomeCategoryQuerySchema,
    req.query,
    'E-tkt-003',
  );
  return sendOk(reply, await service.listIncomeCategories(db, query));
}

export async function getIncomeCategoryById(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await dbToKhaiThue(req);
  const { id } = kiemTraTkt(
    incomeCategoryIdParamsSchema,
    req.params,
    'E-tkt-016',
  );
  return sendOk(reply, await service.getIncomeCategoryById(db, id));
}

export async function createIncomeCategory(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await dbToKhaiThue(req);
  const body = kiemTraTkt(
    createIncomeCategoryBodySchema,
    req.body,
    'E-tkt-003',
  );
  // 201 cho MỌI POST theo ADR-005 Mục 1.
  return sendCreated(reply, await service.createIncomeCategory(db, body));
}

export async function updateIncomeCategory(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await dbToKhaiThue(req);
  const { id } = kiemTraTkt(
    incomeCategoryIdParamsSchema,
    req.params,
    'E-tkt-016',
  );
  const body = kiemTraTkt(
    updateIncomeCategoryBodySchema,
    req.body,
    'E-tkt-003',
  );
  return sendOk(reply, await service.updateIncomeCategory(db, id, body));
}

export async function deleteIncomeCategory(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await dbToKhaiThue(req);
  const { id } = kiemTraTkt(
    incomeCategoryIdParamsSchema,
    req.params,
    'E-tkt-016',
  );
  await service.deleteIncomeCategory(db, id);
  // 204 theo hợp đồng Mục 2.5 — không trả thân phản hồi.
  return reply.status(204).send();
}

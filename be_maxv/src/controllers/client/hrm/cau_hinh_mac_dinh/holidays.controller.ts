import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../../utils/validate';
import { sendCreated, sendOk } from '../../../../helpers/response';
import { resolveTenantDb } from '../../../../helpers/resolveTenantDb';
import {
  createHoliday,
  deleteHoliday,
  getHolidayDetail,
  listHolidays,
  quickGenerateHolidays,
  updateHoliday,
} from '../../../../services/client/hrm/cau_hinh_mac_dinh/holidays.service';
import {
  createHolidaySchema,
  holidayListQuerySchema,
  holidayParamSchema,
  quickGenerateHolidaySchema,
  updateHolidaySchema,
} from '../../../../validators/hrm/cau_hinh_mac_dinh/holidays.validator';

// POST /api/v1/hrm/holidays
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(createHolidaySchema, req.body);
  return sendCreated(reply, await createHoliday(db, body));
}

// GET /api/v1/hrm/holidays
export async function list(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const query = validateQuery(holidayListQuerySchema, req.query);
  return sendOk(reply, await listHolidays(db, query));
}

// GET /api/v1/hrm/holidays/:id
export async function detail(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(holidayParamSchema, req.params);
  return sendOk(reply, await getHolidayDetail(db, id));
}

// PATCH /api/v1/hrm/holidays/:id
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(holidayParamSchema, req.params);
  const body = validateBody(updateHolidaySchema, req.body);
  return sendOk(reply, await updateHoliday(db, id, body));
}

// DELETE /api/v1/hrm/holidays/:id
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(holidayParamSchema, req.params);
  return sendOk(reply, await deleteHoliday(db, id));
}

/*
 * POST /api/v1/hrm/holidays/quick-generate
 *
 * Trả **200**, không phải 201 (ADR-009 Quyết định 2). Thao tác idempotent: lần bấm thứ hai tạo
 * ĐÚNG 0 bản ghi mà vẫn trả 201 là nói dối. Thân phản hồi cũng không phải tài nguyên vừa tạo mà
 * là một báo cáo thống kê (`addedCount` / `skippedCount` / `items`).
 * Đối lập với `POST /holidays` ngay trên: cái đó trả đúng bản ghi vừa tạo nên giữ 201.
 *
 * `dryRun: true` cũng trả **200** với ĐÚNG hình dạng thân phản hồi của lượt ghi thật — giao diện
 * dùng chung một chỗ đọc cho cả xem trước lẫn tạo thật, khác nhau chỉ ở một cờ trong yêu cầu.
 */
export async function quickGenerate(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(quickGenerateHolidaySchema, req.body ?? {});
  return sendOk(reply, await quickGenerateHolidays(db, body.year, body.dryRun));
}

import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { resolveTenantDb } from '../../../../helpers/resolveTenantDb';
import { sendCreated, sendOk } from '../../../../helpers/response';
import { writeLog } from '../../../../services/shared/syslog.service';
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

/**
 * RVW-018 (review-findings.md 2026-09-10) — nhật ký kiểm toán cho 3 thao tác ghi khoản lương.
 * Đúng khuôn `ghiNhatKyCauHinh()` (`generalSettings.controller.ts`): dùng `writeLog` sẵn có
 * (bảng `sys_log` control plane), KHÔNG lưu giá trị trước/sau (mức đã chốt ở BR-hrm-066), chỉ
 * ghi khóa nghiệp vụ (`ma_khoan`) để biết khoản nào bị đổi. `writeLog` ghi-kèm-không-chặn.
 */
async function ghiNhatKyKhoanLuong(
  req: FastifyRequest,
  hanhDong: 'HRM_CREATE_SALARY_ITEM' | 'HRM_UPDATE_SALARY_ITEM' | 'HRM_DELETE_SALARY_ITEM',
  maKhoan: string,
) {
  await writeLog({
    hanhDong,
    userId: req.user.userId,
    donViId: req.user.donViId ?? undefined,
    chiTiet: { khoaNghiepVu: maKhoan },
  });
}

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
// Guard quyền ghi (`assertAdminOrOwner`) gắn ở TẦNG ROUTE (salaryItems.route.ts, RVW-018) —
// controller chỉ còn lo nghiệp vụ + audit.
export async function create(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const body = validateBody(createSalaryItemSchema, req.body);
  const ketQua = await createSalaryItem(db, body);
  await ghiNhatKyKhoanLuong(req, 'HRM_CREATE_SALARY_ITEM', ketQua.ma_khoan);
  return sendCreated(reply, ketQua);
}

// PATCH /api/v1/hrm/salary-items/:id
export async function update(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(idParamSchema, req.params);
  const body = validateBody(updateSalaryItemSchema, req.body);
  const ketQua = await updateSalaryItem(db, id, body);
  await ghiNhatKyKhoanLuong(req, 'HRM_UPDATE_SALARY_ITEM', ketQua.ma_khoan);
  return sendOk(reply, ketQua);
}

// DELETE /api/v1/hrm/salary-items/:id
export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const db = await resolveTenantDb(req);
  const { id } = validateParams(idParamSchema, req.params);
  const { code } = await deleteSalaryItem(db, id);
  await ghiNhatKyKhoanLuong(req, 'HRM_DELETE_SALARY_ITEM', code);
  return sendOk(reply, { message: 'Đã xóa khoản lương thành công.' });
}

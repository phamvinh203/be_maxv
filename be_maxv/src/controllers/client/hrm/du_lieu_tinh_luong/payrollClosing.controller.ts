import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentUserId } from '../../../../helpers/resolveTenantDb';
import { dbCoQuyenLuongPayroll } from '../../../../helpers/hrm/payrollAccessGuard';
import { getPayrollPeriodStatusOrThrow } from '../../../../helpers/hrm/payrollPeriodLockGuard';
import { ghiNhatKyKyLuong } from '../../../../helpers/hrm/nhatKyKyLuong';
import { sendOk } from '../../../../helpers/response';
import { validateParams } from '../../../../utils/validate';
import {
  payrollModuleParamsSchema,
  payrollPeriodIdParamsSchema,
} from '../../../../validators/hrm/du_lieu_tinh_luong/payrollClosing.validator';
import * as service from '../../../../services/client/hrm/du_lieu_tinh_luong/payrollClosing.service';
import {
  layHoTenNguoiDung,
  listPayrollPeriodActivities,
} from '../../../../services/client/hrm/du_lieu_tinh_luong/payrollActivity.service';
import { HANH_DONG_KY_LUONG } from '../../../../constants/hrm/payrollActivities';

/**
 * Màn "Chốt kỳ lương" (BR-dltl-030…034). Mọi thao tác ghi đều để lại dấu vết qua
 * `ghiNhatKyKyLuong` — đó cũng chính là nguồn của "Lịch sử hoạt động" (`GET .../activities`).
 */

export async function overview(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(payrollPeriodIdParamsSchema, req.params);
  const data = await service.getPayrollClosingOverview(db, id);
  const hoTen = await layHoTenNguoiDung(data.modules.map((m) => m.lockedByUserId));
  return sendOk(reply, {
    ...data,
    modules: data.modules.map((m) => ({
      ...m,
      lockedByName: m.lockedByUserId ? (hoTen.get(m.lockedByUserId) ?? null) : null,
    })),
  });
}

export async function activities(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(payrollPeriodIdParamsSchema, req.params);
  // `dbCoQuyenLuongPayroll` đã kiểm quyền vào đúng `donViId` này.
  const donViId = req.user.donViId;
  // Kỳ phải thuộc tenant đang chọn (id bịa -> 404, không trả mảng rỗng như thể kỳ chưa có gì). Hai
  // lượt đọc nằm ở hai DB khác nhau, không phụ thuộc nhau -> chạy song song.
  const [, hoatDong] = await Promise.all([
    getPayrollPeriodStatusOrThrow(db, id),
    donViId ? listPayrollPeriodActivities(donViId, id) : Promise.resolve([]),
  ]);
  return sendOk(reply, hoatDong);
}

export async function lockModule(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id, module } = validateParams(payrollModuleParamsSchema, req.params);
  const ketQua = await service.lockPayrollModule(db, id, module, currentUserId(req));
  await ghiNhatKyKyLuong(req, HANH_DONG_KY_LUONG.MODULE_LOCKED, id, { module });
  return sendOk(reply, ketQua);
}

// Role-guard `assertAdminOrOwner` gắn ở tầng route — mở chốt cùng mức thẩm quyền với "Mở lại kỳ lương".
export async function unlockModule(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id, module } = validateParams(payrollModuleParamsSchema, req.params);
  const ketQua = await service.unlockPayrollModule(db, id, module);
  await ghiNhatKyKyLuong(req, HANH_DONG_KY_LUONG.MODULE_UNLOCKED, id, { module });
  return sendOk(reply, ketQua);
}

export async function lockAll(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(payrollPeriodIdParamsSchema, req.params);
  const ketQua = await service.lockAllPayrollModules(db, id, currentUserId(req));
  // Không bảng kê nào vừa chốt (đã chốt đủ từ trước) thì không có gì để ghi lịch sử.
  if (ketQua.lockedModules.length > 0) {
    await ghiNhatKyKyLuong(req, HANH_DONG_KY_LUONG.MODULES_LOCKED_ALL, id, {
      count: ketQua.lockedModules.length,
      modules: ketQua.lockedModules,
    });
  }
  return sendOk(reply, ketQua);
}

export async function calculate(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { id } = validateParams(payrollPeriodIdParamsSchema, req.params);
  const ketQua = await service.calculatePayrollForPeriod(db, id);
  await ghiNhatKyKyLuong(req, HANH_DONG_KY_LUONG.CALCULATED, id, {
    calculatedEmployees: ketQua.calculatedEmployees,
  });
  return sendOk(reply, ketQua);
}

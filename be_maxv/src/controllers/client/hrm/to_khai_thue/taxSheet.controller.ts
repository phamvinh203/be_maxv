import type { FastifyReply, FastifyRequest } from 'fastify';
import { HANH_DONG_KY_LUONG } from '../../../../constants/hrm/payrollActivities';
import { ghiNhatKyKyLuong } from '../../../../helpers/hrm/nhatKyKyLuong';
import { dbCoQuyenLuongPayroll } from '../../../../helpers/hrm/payrollAccessGuard';
import { kiemTraTkt } from '../../../../helpers/hrm/toKhaiThueValidate';
import { currentUserId } from '../../../../helpers/resolveTenantDb';
import { sendOk } from '../../../../helpers/response';
import { assertAdminOrOwner } from '../../../../routes/hrm/cau_hinh_mac_dinh/generalSettings.route';
import * as service from '../../../../services/client/hrm/to_khai_thue/taxSheet.service';
import {
  lockTaxSheetBodySchema,
  taxSheetQuerySchema,
  unlockTaxSheetBodySchema,
} from '../../../../validators/hrm/to_khai_thue/taxSheet.validator';

/** Bảng tính thuế tháng — 3 endpoint (api-contract Mục 4). */

export async function getTaxSheet(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const query = kiemTraTkt(taxSheetQuerySchema, req.query, 'E-tkt-017');
  return sendOk(reply, await service.getTaxSheet(db, query));
}

export async function lockTaxSheet(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { periodId } = kiemTraTkt(
    lockTaxSheetBodySchema,
    req.body,
    'E-tkt-017',
  );
  const kq = await service.lockTaxSheet(db, periodId, currentUserId(req));
  // Nhật ký NGOÀI giao dịch (hợp đồng Mục 4.2 bước 4) — nhật ký hỏng không làm hỏng việc chốt.
  await ghiNhatKyKyLuong(req, HANH_DONG_KY_LUONG.TAX_SHEET_LOCKED, periodId, {
    count: kq.soDong,
  });
  return sendOk(reply, kq);
}

export async function unlockTaxSheet(req: FastifyRequest, reply: FastifyReply) {
  // Quyền TRƯỚC mọi thứ: người không đủ quyền không được biết kỳ có tồn tại hay đã chốt hay chưa.
  await assertAdminOrOwner(req);
  const db = await dbCoQuyenLuongPayroll(req);
  // Hợp đồng không có mã riêng cho "lý do mở lại quá ngắn" — dùng E-tkt-011 (lỗi thiếu lý do của
  // ghi đè chỉ tiêu, cùng bản chất); thông điệp vẫn nêu đích danh trường `lyDo` và mức 20 ký tự.
  const { periodId, lyDo } = kiemTraTkt(
    unlockTaxSheetBodySchema,
    req.body,
    'E-tkt-011',
  );
  const kq = await service.unlockTaxSheet(db, periodId);
  await ghiNhatKyKyLuong(req, HANH_DONG_KY_LUONG.TAX_SHEET_UNLOCKED, periodId, {
    reason: lyDo,
  });
  return sendOk(reply, kq);
}

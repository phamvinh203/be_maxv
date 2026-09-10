import type { FastifyRequest, FastifyReply } from 'fastify';
import { validateBody } from '../../../../utils/validate';
import { sendOk } from '../../../../helpers/response';
import { resolveTenantDb } from '../../../../helpers/resolveTenantDb';
import { writeLog } from '../../../../services/shared/syslog.service';
import {
  SINGLETON_ID,
  getSettings,
  restoreDefault,
  updateSettings,
} from '../../../../services/client/hrm/cau_hinh_mac_dinh/generalSettings.service';
import { updateGeneralSettingsSchema } from '../../../../validators/hrm/cau_hinh_mac_dinh/generalSettings.validator';

/**
 * Nhật ký kiểm toán cho nhóm 6 của BR-hrm-066 — cập nhật / khôi phục Cấu hình mặc định.
 *
 * Dùng `writeLog` sẵn có của hệ thống (bảng `sys_log` ở control plane), đúng yêu cầu "không phát
 * sinh bảng mới" của BR-hrm-066. Ghi ĐÚNG mức đã chốt: ai, lúc nào, công ty nào, thao tác gì, kèm
 * khóa nghiệp vụ `"DEFAULT"` — **không** lưu giá trị trước và sau (ảnh chụp bản ghi làm nhật ký
 * phình theo dữ liệu và tự nó thành một bản sao dữ liệu phải bảo vệ).
 *
 * `writeLog` là **ghi kèm, không chặn**: bên trong nó tự nuốt lỗi, nên nhật ký hỏng thì thao tác
 * nghiệp vụ vẫn thành công (FR-hrm-043).
 */
async function ghiNhatKyCauHinh(
  req: FastifyRequest,
  hanhDong: 'HRM_UPDATE_GENERAL_SETTINGS' | 'HRM_RESTORE_GENERAL_SETTINGS',
) {
  await writeLog({
    hanhDong,
    userId: req.user.userId,
    donViId: req.user.donViId ?? undefined,
    chiTiet: { khoaNghiepVu: SINGLETON_ID },
  });
}

// GET /api/v1/hrm/settings/general
export async function getGeneralSettings(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(req);
  return sendOk(reply, await getSettings(db));
}

// PUT /api/v1/hrm/settings/general
export async function updateGeneralSettings(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(req);
  const body = validateBody(updateGeneralSettingsSchema, req.body);
  const ketQua = await updateSettings(db, body);
  await ghiNhatKyCauHinh(req, 'HRM_UPDATE_GENERAL_SETTINGS');
  return sendOk(reply, ketQua);
}

/*
 * POST /api/v1/hrm/settings/general/restore-default
 *
 * Trả **200**, không phải 201 (ADR-009 Quyết định 2): thao tác ghi đè bản ghi singleton `DEFAULT`
 * đã tồn tại — không sinh tài nguyên mới, không có URI mới, gọi n lần ra đúng một trạng thái.
 * Luật của hợp đồng: 201 CHỈ khi thân phản hồi chính là tài nguyên vừa được tạo.
 */
export async function restoreDefaultSettings(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await resolveTenantDb(req);
  const ketQua = await restoreDefault(db);
  await ghiNhatKyCauHinh(req, 'HRM_RESTORE_GENERAL_SETTINGS');
  return sendOk(reply, ketQua);
}

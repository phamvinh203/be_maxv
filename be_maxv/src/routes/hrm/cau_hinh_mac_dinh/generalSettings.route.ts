import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/cau_hinh_mac_dinh/generalSettings.controller';
import { ForbiddenError } from '../../../helpers/errors';
import { MESSAGES } from '../../../constants/messages';

/**
 * RBAC Guard: CHỈ ADMIN hoặc OWNER mới có quyền cập nhật hoặc khôi phục Cấu hình mặc định.
 * Người dùng OWNER_EMPLOYEE bị chặn với 403 Forbidden (E-hrm-077).
 */
export async function assertAdminOrOwner(req: FastifyRequest) {
  const role = req.user?.role;
  if (role !== 'ADMIN' && role !== 'OWNER') {
    throw new ForbiddenError(MESSAGES.HRM.CAN_QUYEN_ADMIN_HOAC_OWNER);
  }
}

/**
 * HRM › Cấu hình mặc định toàn công ty (hrm_general_settings).
 * Singleton pattern với id = 'DEFAULT'.
 */
export async function hrmGeneralSettingsRoutes(app: FastifyInstance) {
  app.get('/settings/general', ctrl.getGeneralSettings);
  app.put(
    '/settings/general',
    { preHandler: assertAdminOrOwner },
    ctrl.updateGeneralSettings,
  );
  app.post(
    '/settings/general/restore-default',
    { preHandler: assertAdminOrOwner },
    ctrl.restoreDefaultSettings,
  );
}

import type { FastifyRequest } from 'fastify';
import { canAccessDonVi } from '../access';
import { ForbiddenError } from '../errors';
import { MESSAGES } from '../../constants/messages';

/**
 * preHandler cho nhóm route `/dvc`: kiểm lại quyền vào công ty đang chọn ở MỖI request.
 *
 * `phienDvc` ghép khóa phiên cổng với `donViId` LẤY TỪ JWT — vé sống 15 phút và cố ý không đối chiếu
 * DB, nên người vừa bị thu quyền vào công ty (hoặc công ty vừa bị admin khóa) vẫn mở captcha, đăng nhập,
 * tải file trên cổng thuế bằng phiên của công ty đó tới khi vé hết hạn (vbsec 2026-09-10). Các handler
 * đọc DB tenant vốn đã kiểm qua `resolveTenantDb`; handler chỉ gọi cổng thì không — gắn ở tầng route để
 * không sót handler nào.
 *
 * Chưa chọn công ty -> cho qua: handler tự trả 400 "Chưa chọn công ty".
 */
export async function kiemCongTyDangChon(req: FastifyRequest): Promise<void> {
  const donViId = req.user?.donViId;
  if (!donViId) return;
  if (!(await canAccessDonVi(req.user.userId, req.user.role, donViId))) {
    throw new ForbiddenError(MESSAGES.COMPANY.NO_ACCESS);
  }
}

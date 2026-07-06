import type { FastifyRequest } from 'fastify';
import { sysPrisma } from '../config/db.sys';
import { getTenantDb } from './tenantClient';
import { canAccessDonVi } from './access';
import { ForbiddenError, NotFoundError } from './errors';
import { MESSAGES } from '../constants/messages';
import type { PrismaClient } from '../generated/tenant';

/**
 * Chọn Prisma client cho DB tenant của request hiện tại.
 *
 *   req.user.donViId  ->  kiểm tra quyền (canAccessDonVi)  ->  tra don_vi.dbName
 *   (control plane)  ->  getTenantDb(dbName)
 *
 * Yêu cầu route đã gắn `authenticate` (req.user luôn có mặt). Chưa chọn công ty
 * (donViId=null) -> 403; không còn quyền vào MST trong token -> 403; công ty chưa
 * cấp DB xong -> 404.
 */
export async function resolveTenantDb(
  req: FastifyRequest,
): Promise<PrismaClient> {
  const donViId = req.user?.donViId;
  if (!donViId) {
    throw new ForbiddenError(MESSAGES.COMPANY.NO_COMPANY);
  }

  // Phòng thủ: token có thể cũ (quyền vào MST đã bị thu hồi sau khi cấp token).
  const allowed = await canAccessDonVi(req.user.userId, req.user.role, donViId);
  if (!allowed) {
    throw new ForbiddenError(MESSAGES.COMPANY.NO_ACCESS);
  }

  const company = await sysPrisma.donVi.findUnique({
    where: { id: donViId },
    select: { dbName: true },
  });
  if (!company?.dbName) {
    throw new NotFoundError(MESSAGES.COMPANY.NO_TENANT_DB);
  }

  return getTenantDb(company.dbName);
}

/** user_id cho cột audit (user_id0/user_id2). */
export function currentUserId(req: FastifyRequest): string {
  return req.user.userId;
}

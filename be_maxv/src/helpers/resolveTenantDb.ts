import type { FastifyRequest } from 'fastify';
import { sysPrisma } from '../config/db.sys';
import { getTenantDb } from './tenantClient';
import { accessibleDonViWhere } from './access';
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
  return getTenantDb(await resolveTenantDbName(req));
}

/** Thông tin tenant của request: DB + MST (để guard chống ghi nhầm data MST khác). */
export interface TenantInfo {
  dbName: string;
  maSoThue: string;
}

/**
 * Kiểm quyền + lấy `{ dbName, maSoThue }` của công ty đang chọn trong 1 query.
 *   req.user.donViId -> canAccessDonVi -> don_vi(dbName, maSoThue)
 * Chưa chọn công ty -> 403; hết quyền -> 403; chưa cấp DB -> 404. Dùng khi cần cả MST
 * (luồng lưu hóa đơn: đối chiếu chủ hóa đơn phải khớp MST tenant).
 */
export async function resolveTenantInfo(req: FastifyRequest): Promise<TenantInfo> {
  const donViId = req.user?.donViId;
  if (!donViId) {
    throw new ForbiddenError(MESSAGES.COMPANY.NO_COMPANY);
  }

  // 1 query: vừa kiểm tra quyền (token có thể cũ, quyền đã bị thu hồi) vừa lấy dbName + MST.
  const scope = accessibleDonViWhere(req.user.userId, req.user.role);
  if (!scope) {
    throw new ForbiddenError(MESSAGES.COMPANY.NO_ACCESS);
  }
  const company = await sysPrisma.donVi.findFirst({
    where: { ...scope, id: donViId },
    select: { dbName: true, maSoThue: true },
  });
  if (!company) {
    throw new ForbiddenError(MESSAGES.COMPANY.NO_ACCESS);
  }
  if (!company.dbName) {
    throw new NotFoundError(MESSAGES.COMPANY.NO_TENANT_DB);
  }

  return { dbName: company.dbName, maSoThue: company.maSoThue };
}

/**
 * Như `resolveTenantDb` nhưng trả `dbName` (db_<MST>) thay vì client. Dùng cho tiến trình chạy
 * NỀN kéo dài (vd `runDetailFetch`): gọi lại `getTenantDb(dbName)` định kỳ để refresh `lastUsed`,
 * tránh bị sweeper (idle > 10') đóng pool giữa chừng rồi mọi query hỏng.
 */
export async function resolveTenantDbName(req: FastifyRequest): Promise<string> {
  return (await resolveTenantInfo(req)).dbName;
}

/** user_id cho cột audit (user_id0/user_id2). */
export function currentUserId(req: FastifyRequest): string {
  return req.user.userId;
}

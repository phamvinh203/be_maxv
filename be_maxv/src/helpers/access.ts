import { sysPrisma } from '../config/db.sys';
import type { Prisma } from '../generated/sys';

/**
 * Nguồn DUY NHẤT của quy tắc "user được thao tác trên những MST nào".
 * Trả về điều kiện lọc DonVi theo vai trò; null = không có phạm vi tenant (ADMIN…).
 *   - OWNER          -> các DonVi mình sở hữu (ownerId = self).
 *   - OWNER_EMPLOYEE -> các DonVi được cấp qua DonViAccess.
 *
 * Dùng chung cho: canAccessDonVi (1 MST), listAccessibleCompanies (tất cả),
 * và resolveTenantDb (chọn DB tenant) — thêm role mới chỉ sửa 1 chỗ.
 */
export function accessibleDonViWhere(
  userId: string,
  role: string,
): Prisma.DonViWhereInput | null {
  // Công ty đã bị owner "xóa" (ARCHIVED) không còn thao tác được nữa (list/switch/resolveTenantDb).
  if (role === 'OWNER') return { ownerId: userId, status: { not: 'ARCHIVED' } };
  if (role === 'OWNER_EMPLOYEE')
    return { access: { some: { userId } }, status: { not: 'ARCHIVED' } };
  return null;
}

/** user có quyền thao tác trên 1 công ty (MST) cụ thể hay không. */
export async function canAccessDonVi(
  userId: string,
  role: string,
  donViId: string,
): Promise<boolean> {
  const scope = accessibleDonViWhere(userId, role);
  if (!scope) return false;

  const dv = await sysPrisma.donVi.findFirst({
    where: { ...scope, id: donViId },
    select: { id: true },
  });
  return dv !== null;
}

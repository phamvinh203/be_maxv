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
// Owner xóa công ty giờ là XÓA CỨNG (destroyCompany: DROP DB + xóa bản ghi) nên không còn code nào
// gán ARCHIVED. Giữ bộ lọc cho dữ liệu cũ đã ARCHIVED trước khi đổi: vẫn ẩn khỏi list/switch/resolveTenantDb.
const NOT_ARCHIVED = { status: { not: 'ARCHIVED' } } as const;

export function accessibleDonViWhere(
  userId: string,
  role: string,
): Prisma.DonViWhereInput | null {
  if (role === 'OWNER') return { ownerId: userId, ...NOT_ARCHIVED };
  if (role === 'OWNER_EMPLOYEE') return { access: { some: { userId } }, ...NOT_ARCHIVED };
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

import { sysPrisma } from '../config/db.sys';

/**
 * Nguồn quy tắc DUY NHẤT: user có quyền thao tác trên 1 công ty (MST) hay không.
 *
 *   - OWNER          -> sở hữu công ty (DonVi.ownerId === userId); thấy hết MST của mình.
 *   - OWNER_EMPLOYEE -> phải có dòng trong DonViAccess (được owner cấp).
 *   - ADMIN (hệ thống) -> không dùng luồng tenant này -> false.
 *
 * Dùng ở: POST /companies/:id/switch (trước khi cấp lại token) và resolveTenantDb
 * (phòng thủ khi token cũ, quyền đã bị thu hồi).
 */
export async function canAccessDonVi(
  userId: string,
  role: string,
  donViId: string,
): Promise<boolean> {
  if (role === 'OWNER') {
    const dv = await sysPrisma.donVi.findFirst({
      where: { id: donViId, ownerId: userId },
      select: { id: true },
    });
    return dv !== null;
  }

  if (role === 'OWNER_EMPLOYEE') {
    const access = await sysPrisma.donViAccess.findUnique({
      where: { userId_donViId: { userId, donViId } },
      select: { id: true },
    });
    return access !== null;
  }

  return false;
}

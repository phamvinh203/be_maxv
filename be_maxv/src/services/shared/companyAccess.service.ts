import { sysPrisma } from '../../config/db.sys';
import { accessibleDonViWhere } from '../../helpers/access';

/** Trường tóm tắt công ty trả cho FE (danh sách chọn / switcher). */
const COMPANY_SUMMARY_SELECT = {
  id: true,
  maSoThue: true,
  slug: true,
  tenDonVi: true,
  status: true,
} as const;

/**
 * Danh sách công ty (MST) user được phép thao tác — dùng cho login và GET /companies.
 * Phạm vi theo vai trò do accessibleDonViWhere quyết định (ADMIN -> []).
 */
export function listAccessibleCompanies(userId: string, role: string) {
  const where = accessibleDonViWhere(userId, role);
  if (!where) return Promise.resolve([]);

  return sysPrisma.donVi.findMany({
    where,
    select: COMPANY_SUMMARY_SELECT,
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Xác định "chủ tài khoản" của user hiện tại — dùng để gom nhân viên/lời mời theo account.
 *   - OWNER          -> chính user đó.
 *   - OWNER_EMPLOYEE -> owner của họ (User.ownerId).
 *   - ADMIN / không xác định -> null.
 */
export async function resolveAccountOwnerId(
  userId: string,
  role: string,
): Promise<string | null> {
  if (role === 'OWNER') return userId;
  if (role === 'OWNER_EMPLOYEE') {
    const u = await sysPrisma.user.findUnique({
      where: { id: userId },
      select: { ownerId: true },
    });
    return u?.ownerId ?? null;
  }
  return null;
}

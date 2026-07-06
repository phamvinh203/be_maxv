import { sysPrisma } from '../../config/db.sys';

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
 *
 *   - OWNER          -> mọi DonVi mình sở hữu (DonVi.ownerId === userId).
 *   - OWNER_EMPLOYEE -> các DonVi được cấp qua DonViAccess.
 *   - ADMIN          -> [] (không quản lý dữ liệu tenant qua luồng này).
 */
export function listAccessibleCompanies(userId: string, role: string) {
  if (role === 'OWNER') {
    return sysPrisma.donVi.findMany({
      where: { ownerId: userId },
      select: COMPANY_SUMMARY_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  if (role === 'OWNER_EMPLOYEE') {
    return sysPrisma.donVi.findMany({
      where: { access: { some: { userId } } },
      select: COMPANY_SUMMARY_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  return Promise.resolve([]);
}

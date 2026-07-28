import { sysPrisma } from '../../config/db.sys';
import type { Prisma } from '../../generated/sys';
import { accessibleDonViWhere } from '../../helpers/access';

/** Trường tóm tắt công ty trả cho FE (danh sách chọn / switcher) — giữ gọn cho login. */
const COMPANY_SUMMARY_SELECT = {
  id: true,
  maSoThue: true,
  slug: true,
  tenDonVi: true,
  status: true,
} as const;

/** Trường chi tiết cho bảng quản lý công ty (Cài đặt › Công ty/MST). */
const COMPANY_DETAIL_SELECT = {
  ...COMPANY_SUMMARY_SELECT,
  diaChi: true,
  sdt: true,
  loaiHinhKinhDoanh: true,
} as const;

/**
 * Danh sách công ty (MST) user được phép thao tác, theo bộ trường `select`.
 * Phạm vi theo vai trò do accessibleDonViWhere quyết định (ADMIN -> []).
 */
function queryAccessibleCompanies<T extends Prisma.DonViSelect>(
  userId: string,
  role: string,
  select: T,
) {
  const where = accessibleDonViWhere(userId, role);
  if (!where) return Promise.resolve([]);

  return sysPrisma.donVi.findMany({
    where,
    select,
    orderBy: { createdAt: 'asc' },
  });
}

/** Bản tóm tắt — dùng cho login (Select đổi MST). */
export function listAccessibleCompanies(userId: string, role: string) {
  return queryAccessibleCompanies(userId, role, COMPANY_SUMMARY_SELECT);
}

/** Bản chi tiết (kèm địa chỉ/SĐT/loại hình) — dùng cho GET /companies. */
export function listAccessibleCompaniesDetailed(userId: string, role: string) {
  return queryAccessibleCompanies(userId, role, COMPANY_DETAIL_SELECT);
}

/**
 * Công ty đầu tiên user còn truy cập được (null nếu không còn công ty nào) — dùng khi cần CHỌN LẠI
 * công ty đang làm việc, vd sau khi xóa vĩnh viễn công ty đang dùng. Cùng thứ tự `createdAt asc`
 * với danh sách hiển thị, nên "công ty đầu tiên" ở đây đúng là công ty đầu bảng mà user nhìn thấy.
 */
export async function firstAccessibleCompanyId(
  userId: string,
  role: string,
): Promise<string | null> {
  const where = accessibleDonViWhere(userId, role);
  if (!where) return null;

  const company = await sysPrisma.donVi.findFirst({
    where,
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return company?.id ?? null;
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

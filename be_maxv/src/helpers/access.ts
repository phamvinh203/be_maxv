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
// Công ty ở hai trạng thái này bị ẩn khỏi list/switch/resolveTenantDb — nghĩa là không ai vào được:
//   - SUSPENDED: admin "tạm khóa truy cập" (adminSuspendCompany). Đây là chỗ DUY NHẤT thực thi lệnh khóa;
//     admin mở khóa (về READY) là công ty hiện lại, dữ liệu còn nguyên.
//   - ARCHIVED: dữ liệu cũ của luồng soft-delete trước đây. Owner xóa công ty giờ là XÓA CỨNG
//     (destroyCompany: DROP DB + xóa bản ghi) nên không còn code nào gán ARCHIVED.
const CON_TRUY_CAP_DUOC = {
  status: { notIn: ['SUSPENDED', 'ARCHIVED'] },
} satisfies Prisma.DonViWhereInput;

export function accessibleDonViWhere(
  userId: string,
  role: string,
): Prisma.DonViWhereInput | null {
  if (role === 'OWNER') return { ownerId: userId, ...CON_TRUY_CAP_DUOC };
  if (role === 'OWNER_EMPLOYEE') return { access: { some: { userId } }, ...CON_TRUY_CAP_DUOC };
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

import { sysPrisma } from '../../config/db.sys';
import { generatePassword, hashPassword } from '../../utils/password';
import { writeLog } from '../shared/syslog.service';
import { ConflictError, NotFoundError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type { Prisma, Role } from '../../generated/sys';
import type { ListUsersQuery } from '../../validators/admin.validator';

// KHÔNG bao giờ trả password. Kèm chủ tài khoản + số MST liên quan để hiển thị.
const USER_SELECT = {
  id: true,
  email: true,
  sdt: true,
  hoTen: true,
  role: true,
  status: true,
  isActive: true,
  ownerId: true,
  createdAt: true,
  owner: { select: { id: true, hoTen: true, email: true } },
  _count: { select: { ownedDonVi: true, donViAccess: true } },
} satisfies Prisma.UserSelect;

/** Lấy user (chỉ id+ownerId+role) hoặc ném NotFound. */
async function getOrThrow(id: string) {
  const user = await sysPrisma.user.findUnique({
    where: { id },
    select: { id: true, ownerId: true, role: true },
  });
  if (!user) throw new NotFoundError(MESSAGES.USER.NOT_FOUND);
  return user;
}

/** Ghi audit cho thao tác admin lên 1 user — gói envelope dùng chung. */
function logUserAction(
  adminId: string,
  target: { id: string; ownerId: string | null },
  hanhDong: string,
  chiTiet: Prisma.InputJsonObject = {},
) {
  return writeLog({
    hanhDong,
    userId: adminId,
    chiTiet: { targetUserId: target.id, ownerId: target.ownerId, ...chiTiet },
  });
}

/** GET /admin/users — danh sách + lọc role/status/MST/từ khóa, phân trang. */
export async function adminListUsers(query: ListUsersQuery) {
  const { role, status, donViId, q, page, pageSize } = query;

  const where: Prisma.UserWhereInput = {};
  const and: Prisma.UserWhereInput[] = [];
  if (role) where.role = role;
  if (status) where.status = status;
  // Lọc theo MST: user sở hữu MST đó (owner) hoặc được cấp quyền (nhân viên).
  if (donViId) {
    and.push({
      OR: [
        { ownedDonVi: { some: { id: donViId } } },
        { donViAccess: { some: { donViId } } },
      ],
    });
  }
  if (q) {
    and.push({
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { hoTen: { contains: q, mode: 'insensitive' } },
        { sdt: { contains: q } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const [data, total] = await Promise.all([
    sysPrisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    sysPrisma.user.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

/** POST /admin/users/:id/(de)activate — bật/tắt isActive. */
export async function adminSetUserActive(
  id: string,
  active: boolean,
  adminId: string,
) {
  const user = await getOrThrow(id);
  if (!active && id === adminId) {
    throw new ConflictError(MESSAGES.USER.CANNOT_DEACTIVATE_SELF);
  }

  const updated = await sysPrisma.user.update({
    where: { id },
    data: { isActive: active },
    select: USER_SELECT,
  });
  await logUserAction(
    adminId,
    user,
    active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
  );
  return updated;
}

/** PATCH /admin/users/:id/role — đổi vai trò (không đổi của chính mình). */
export async function adminChangeUserRole(
  id: string,
  role: Role,
  adminId: string,
) {
  const user = await getOrThrow(id);
  if (id === adminId) {
    throw new ConflictError(MESSAGES.USER.CANNOT_CHANGE_OWN_ROLE);
  }
  // Không hạ/đổi vai trò của tài khoản ADMIN qua UI (chỉ thao tác qua DB).
  if (user.role === 'ADMIN') {
    throw new ConflictError(MESSAGES.USER.CANNOT_CHANGE_ADMIN);
  }

  const updated = await sysPrisma.user.update({
    where: { id },
    data: { role },
    select: USER_SELECT,
  });
  await logUserAction(adminId, user, 'CHANGE_USER_ROLE', { role });
  return updated;
}

/**
 * POST /admin/users/:id/reset-password — sinh mật khẩu mới, trả về 1 lần cho
 * admin (chưa có hạ tầng email). KHÔNG lưu/log mật khẩu thô.
 */
export async function adminResetPassword(id: string, adminId: string) {
  const user = await getOrThrow(id);
  const password = generatePassword();

  await sysPrisma.user.update({
    where: { id },
    data: { password: await hashPassword(password) },
  });
  await logUserAction(adminId, user, 'RESET_PASSWORD');
  return { password };
}

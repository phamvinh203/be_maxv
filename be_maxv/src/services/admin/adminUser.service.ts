import { sysPrisma } from '../../config/db.sys';
import { generatePassword, hashPassword } from '../../utils/password';
import { writeLog } from '../shared/syslog.service';
import { dropTenant } from '../shared/provisioning.service';
import { ConflictError, NotFoundError } from '../../helpers/errors';
import { findOrThrow } from '../../helpers/crudGuards';
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
  // `employees` để dialog xóa cảnh báo đúng số nhân viên sẽ bị cascade xóa theo owner.
  _count: { select: { ownedDonVi: true, donViAccess: true, employees: true } },
} satisfies Prisma.UserSelect;

/** Lấy user (chỉ id+ownerId+role) hoặc ném NotFound. */
function getOrThrow(id: string) {
  return findOrThrow(
    () =>
      sysPrisma.user.findUnique({
        where: { id },
        select: { id: true, ownerId: true, role: true },
      }),
    new NotFoundError(MESSAGES.USER.NOT_FOUND),
  );
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

/**
 * Admin phải gõ lại email để xác nhận xóa. Verify LẠI ở server chứ không chỉ chặn ở dialog:
 * thao tác này DROP DATABASE mọi MST của tài khoản, không thể để một request gõ tay bỏ qua
 * lớp bảo vệ của UI. (Chuẩn hóa là việc của `deleteUserSchema`, ở đây chỉ so bằng.)
 */
export function assertEmailConfirmed(input: string, actual: string): void {
  if (input !== actual) throw new ConflictError(MESSAGES.USER.EMAIL_MISMATCH);
}

/**
 * DELETE /admin/users/:id — XÓA VĨNH VIỄN tài khoản. Không hoàn tác được.
 *
 * Cascade trong schema kéo theo: nhân viên của owner, thuê bao, quyền truy cập MST, lời mời,
 * OTP, và TOÀN BỘ don_vi của owner. Nhưng cascade CHỈ chạm tới db_sys — database tenant
 * `maxv2_<MST>_app` nằm ngoài tầm với của Postgres FK, phải tự DROP. Không làm thì mỗi lần
 * xóa owner là để lại một đống database rác không còn bản ghi nào truy ngược được.
 *
 * Thứ tự DROP-trước-xóa-row giống `destroyCompany` và vì cùng lý do: DROP DATABASE không chạy
 * trong transaction Postgres nên phải chọn hướng thất bại ít tệ hơn —
 *   - DROP xong mà xóa user lỗi -> row trỏ DB đã mất, admin xóa lại được.
 *   - Xóa user trước mà DROP lỗi -> database thành rác vĩnh viễn, không còn gì truy vết.
 *
 * DROP tuần tự chứ không Promise.all: mỗi lần DROP đều gỡ pool + ép ngắt kết nối, chạy song
 * song thì lỗi ở giữa chừng để lại trạng thái khó lần hơn nhiều so với việc chậm vài giây.
 */
export async function adminDeleteUser(
  id: string,
  confirmEmail: string,
  adminId: string,
) {
  const user = await findOrThrow(
    () =>
      sysPrisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          hoTen: true,
          role: true,
          ownerId: true,
          ownedDonVi: { select: { id: true, maSoThue: true, dbName: true } },
          _count: { select: { employees: true } },
        },
      }),
    new NotFoundError(MESSAGES.USER.NOT_FOUND),
  );

  if (id === adminId) throw new ConflictError(MESSAGES.USER.CANNOT_DELETE_SELF);
  if (user.role === 'ADMIN') {
    throw new ConflictError(MESSAGES.USER.CANNOT_DELETE_ADMIN);
  }
  assertEmailConfirmed(confirmEmail, user.email);

  // dbName rỗng khi provisioning chưa xong (PROVISIONING/FAILED) — không có DB nào để xóa.
  for (const dv of user.ownedDonVi) {
    if (dv.dbName) await dropTenant(dv.dbName);
  }

  await sysPrisma.user.delete({ where: { id } });

  // Bản ghi đã mất -> nhét đủ thông tin vào chiTiet để dấu vết audit tự đọc được.
  await logUserAction(adminId, user, 'DELETE_USER', {
    email: user.email,
    hoTen: user.hoTen,
    role: user.role,
    soNhanVien: user._count.employees,
    donVi: user.ownedDonVi.map((d) => ({
      maSoThue: d.maSoThue,
      dbName: d.dbName,
    })),
  });

  return {
    id,
    soDonViDaXoa: user.ownedDonVi.length,
    soNhanVienDaXoa: user._count.employees,
  };
}

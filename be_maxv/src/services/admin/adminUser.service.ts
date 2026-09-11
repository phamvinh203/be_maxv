import { sysPrisma } from '../../config/db.sys';
import { bamMatKhauKhongAiBiet } from '../../utils/password';
import { sendMail } from '../shared/mailer.service';
import { adminResetPasswordEmail } from '../../helpers/mailTemplates';
import { writeLog } from '../shared/syslog.service';
import { dropTenant } from '../shared/provisioning.service';
import { tenantDbName } from '../../utils/dbName';
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
  // Không khóa/mở tài khoản ADMIN khác qua UI (cùng quy tắc với đổi vai trò / xóa): một admin
  // bị chiếm không được khóa hết các admin còn lại.
  if (user.role === 'ADMIN') {
    throw new ConflictError(MESSAGES.USER.CANNOT_TOGGLE_ADMIN);
  }

  const updated = await sysPrisma.user.update({
    where: { id },
    // Khóa thì thu hồi luôn mọi refresh token đã phát — không thì mở lại tài khoản sẽ làm sống
    // lại mọi phiên cũ (kể cả phiên của kẻ đã chiếm tài khoản, lý do thường gặp để khóa).
    data: active
      ? { isActive: true }
      : { isActive: false, tokenVersion: { increment: 1 } },
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
    // Lên OWNER = thành chủ tài khoản độc lập: bỏ `ownerId`. Giữ lại thì user này vẫn là tài khoản
    // con của owner cũ — xóa owner cũ sẽ xóa dây chuyền cả user này lẫn các công ty họ tự tạo.
    data: role === 'OWNER' ? { role, ownerId: null } : { role },
    select: USER_SELECT,
  });
  await logUserAction(adminId, user, 'CHANGE_USER_ROLE', { role });
  return updated;
}

/**
 * POST /admin/users/:id/reset-password — VÔ HIỆU mật khẩu hiện tại (thay bằng mật khẩu không ai biết) + đá
 * mọi phiên, rồi email hướng dẫn người dùng TỰ đặt mật khẩu mới bằng "Quên mật khẩu".
 *
 * Không sinh mật khẩu trả cho admin nữa (vbsec 2026-09-10): mật khẩu rõ hiện trên màn hình admin rồi đi qua
 * kênh bất kỳ tới người dùng — admin (và kênh đó) biết mật khẩu người dùng. Gửi mail hỏng KHÔNG hoàn tác:
 * lý do thường gặp để reset là tài khoản bị chiếm, phải khóa ngay; người dùng vẫn tự vào bằng "Quên mật
 * khẩu" — `daGuiEmail: false` để admin báo họ.
 */
export async function adminResetPassword(
  id: string,
  adminId: string,
): Promise<{ email: string; daGuiEmail: boolean }> {
  const user = await getOrThrow(id);
  // Đích là ADMIN khác thì đây là khóa tài khoản quản trị của người khác — không cho qua giao diện.
  if (user.role === 'ADMIN') {
    throw new ConflictError(MESSAGES.USER.CANNOT_RESET_ADMIN_PASSWORD);
  }
  const lienHe = await findOrThrow(
    () => sysPrisma.user.findUnique({ where: { id }, select: { email: true, hoTen: true } }),
    new NotFoundError(MESSAGES.USER.NOT_FOUND),
  );

  await sysPrisma.user.update({
    where: { id },
    // Tăng tokenVersion như luồng tự đặt lại bằng OTP: mọi refresh token đã phát (có thể của kẻ
    // đã chiếm tài khoản — lý do thường gặp để admin reset) hết hiệu lực.
    data: {
      password: await bamMatKhauKhongAiBiet(),
      tokenVersion: { increment: 1 },
    },
  });
  await logUserAction(adminId, user, 'RESET_PASSWORD');

  const daGuiEmail = await sendMail({
    to: lienHe.email,
    ...adminResetPasswordEmail({ hoTen: lienHe.hoTen, email: lienHe.email }),
  }).then(
    () => true,
    (err) => {
      console.error(`[adminResetPassword] sendMail lỗi cho user ${id}:`, err);
      return false;
    },
  );
  return { email: lienHe.email, daGuiEmail };
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

  // Cascade xóa CẢ các tài khoản con (User.ownerId -> owner, nhiều tầng nếu dữ liệu cũ có tài khoản con
  // được nâng OWNER mà còn giữ ownerId) cùng mọi don_vi của họ — nên phải DROP DB của TẤT CẢ công ty đó,
  // không chỉ công ty của chính user này. dbName rỗng (PROVISIONING/FAILED) thì DROP theo tên suy từ
  // MST: DB vật lý có thể đã được tạo trước khi hỏng.
  const donViBiXoa = await donViCuaCayTaiKhoan(id);
  for (const dv of donViBiXoa) {
    await dropTenant(dv.dbName ?? tenantDbName(dv.maSoThue));
  }

  await sysPrisma.user.delete({ where: { id } });

  // Bản ghi đã mất -> nhét đủ thông tin vào chiTiet để dấu vết audit tự đọc được.
  await logUserAction(adminId, user, 'DELETE_USER', {
    email: user.email,
    hoTen: user.hoTen,
    role: user.role,
    soNhanVien: user._count.employees,
    donVi: donViBiXoa.map((d) => ({
      maSoThue: d.maSoThue,
      dbName: d.dbName,
    })),
  });

  return {
    id,
    soDonViDaXoa: donViBiXoa.length,
    soNhanVienDaXoa: user._count.employees,
  };
}

/** Mọi don_vi sẽ bị cascade xóa khi xóa user `id`: của chính user + của toàn bộ cây tài khoản con. */
async function donViCuaCayTaiKhoan(id: string) {
  const tatCa = new Set<string>([id]);
  let tangHienTai = [id];
  while (tangHienTai.length > 0) {
    const con = await sysPrisma.user.findMany({
      where: { ownerId: { in: tangHienTai } },
      select: { id: true },
    });
    tangHienTai = con.map((c) => c.id).filter((cid) => !tatCa.has(cid));
    tangHienTai.forEach((cid) => tatCa.add(cid));
  }
  return sysPrisma.donVi.findMany({
    where: { ownerId: { in: [...tatCa] } },
    select: { id: true, maSoThue: true, dbName: true },
  });
}

import { sysPrisma } from '../../config/db.sys';
import { tenantSlug } from '../../utils/dbName';
import { provisionTenant } from '../shared/provisioning.service';
import { createTrialSubscription } from '../shared/subscription.service';
import { assertMstLimit, assertUserLimit } from '../shared/limits.service';
import { writeLog } from '../shared/syslog.service';
import { sendMail } from '../shared/mailer.service';
import {
  ConflictError,
  ForbiddenError,
  MailError,
  NotFoundError,
} from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type { RegisterCompanyInput } from '../../validators/company.validator';
import type { InviteUserInput } from '../../validators/company.validator';

/** ownerId lấy từ JWT (req.user.userId) của owner đang đăng nhập, không nhận từ body. */
type RegisterCompanyArgs = RegisterCompanyInput & { ownerId: string };

/**
 * BƯỚC 2 — Owner đăng ký MỘT công ty/MST (có thể nhiều MST mỗi tài khoản).
 * Tạo don_vi (ownerId = owner) + cấp DB riêng maxv2_<mst>_app.
 * Thuê bao dùng thử đã được gán khi đăng ký tài khoản; ở đây chỉ gọi lại làm
 * lưới an toàn idempotent (bù cho tài khoản cũ đăng ký trước khi có logic này).
 */
export async function registerCompany(input: RegisterCompanyArgs) {
  const { ownerId, tenCongTy, maSoThue, diaChi, sdt, loaiHinhKinhDoanh } = input;

  // Đếm MST hiện có + kiểm tra MST trùng.
  const [existingCount, mstExists] = await Promise.all([
    sysPrisma.donVi.count({ where: { ownerId } }),
    sysPrisma.donVi.findUnique({ where: { maSoThue } }),
  ]);

  if (mstExists) throw new ConflictError(MESSAGES.COMPANY.MST_TAKEN);
  await assertMstLimit(ownerId, existingCount); // trần MST (override ?? gói)

  const donVi = await sysPrisma.donVi.create({
    data: {
      ownerId,
      maSoThue,
      slug: tenantSlug(maSoThue),
      tenDonVi: tenCongTy,
      diaChi,
      sdt,
      loaiHinhKinhDoanh,
      status: 'PROVISIONING',
    },
  });

  // Cấp DB riêng cho MST.
  const dbName = await provisionTenant(donVi.id, maSoThue);

  // Lưới an toàn: đảm bảo tài khoản có thuê bao (idempotent, no-op nếu đã có).
  if (existingCount === 0) {
    await createTrialSubscription(ownerId).catch(() => undefined);
  }

  await writeLog({
    hanhDong: 'CREATE_COMPANY',
    userId: ownerId,
    donViId: donVi.id,
    chiTiet: { maSoThue, dbName },
  });

  return {
    id: donVi.id,
    maSoThue,
    slug: donVi.slug,
    tenDonVi: tenCongTy,
    diaChi,
    sdt,
    loaiHinhKinhDoanh,
    status: donVi.status,
    dbName,
  };
}

interface InviteEmployeeInput extends InviteUserInput {
  ownerId: string; // chủ tài khoản gửi lời mời (req.user.userId — đã yêu cầu role OWNER)
  requestedById: string; // userId của owner gửi lời mời
}

interface NewInviteNotice {
  ownerHoTen: string;
  email: string;
  hoTen: string;
  chucVu: string;
  congTy: { tenDonVi: string; maSoThue: string }[];
}

/** Báo cho tất cả admin hệ thống có 1 lời mời nhân viên mới đang chờ duyệt. */
async function notifyAdminsOfNewInvite(n: NewInviteNotice): Promise<void> {
  const admins = await sysPrisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true },
  });
  if (admins.length === 0) return; // không có admin nào để báo -> coi như xong

  try {
    await sendMail({
      to: admins.map((a) => a.email),
      subject: 'Yêu cầu duyệt lời mời nhân viên mới',
      text: [
        `Người gửi mời: ${n.ownerHoTen}`,
        `Nhân viên được mời: ${n.hoTen} <${n.email}>`,
        `Chức vụ: ${n.chucVu}`,
        `Công ty được cấp: ${n.congTy
          .map((c) => `${c.tenDonVi} (${c.maSoThue})`)
          .join(', ')}`,
      ].join('\n'),
    });
  } catch {
    throw new MailError(MESSAGES.COMPANY.INVITE_NOTIFY_FAILED);
  }
}

// BƯỚC 3 — Owner mời nhân viên vào TÀI KHOẢN + cấp quyền vào các MST cụ thể (admin duyệt).
// Mọi lời mời role = OWNER_EMPLOYEE; chức vụ là text tự do; donViIds là MST được cấp.
export async function inviteUserToCompany(input: InviteEmployeeInput) {
  const { ownerId, requestedById, email, hoTen, chucVu, donViIds } = input;

  // Chỉ được cấp các MST do chính owner sở hữu.
  const ownedCongTy = await sysPrisma.donVi.findMany({
    where: { id: { in: donViIds }, ownerId },
    select: { id: true, tenDonVi: true, maSoThue: true },
  });
  if (ownedCongTy.length !== donViIds.length) {
    throw new ForbiddenError(MESSAGES.COMPANY.NO_ACCESS);
  }

  const [employeeCount, owner, existingUser, pendingInvite] = await Promise.all([
    sysPrisma.user.count({ where: { ownerId } }),
    sysPrisma.user.findUnique({
      where: { id: ownerId },
      select: { hoTen: true },
    }),
    sysPrisma.user.findUnique({ where: { email } }),
    sysPrisma.inviteRequest.findFirst({
      where: { ownerId, email, status: 'PENDING' },
    }),
  ]);

  // 1 email = 1 tài khoản: email đã có user -> không mời làm nhân viên tài khoản khác.
  if (existingUser) {
    throw new ConflictError(MESSAGES.COMPANY.EMAIL_ALREADY_MEMBER);
  }
  if (pendingInvite) {
    throw new ConflictError(MESSAGES.COMPANY.INVITE_ALREADY_PENDING);
  }
  await assertUserLimit(ownerId, employeeCount); // trần nhân viên (override ?? gói)

  const invite = await sysPrisma.inviteRequest.create({
    data: {
      ownerId,
      email,
      hoTen,
      chucVu,
      donViIds,
      role: 'OWNER_EMPLOYEE',
      requestedById,
    },
  });

  // Báo admin là yêu cầu bắt buộc — mail lỗi thì hủy luôn lời mời vừa tạo.
  try {
    await notifyAdminsOfNewInvite({
      ownerHoTen: owner?.hoTen ?? '',
      email,
      hoTen,
      chucVu,
      congTy: ownedCongTy,
    });
  } catch (err) {
    await sysPrisma.inviteRequest.delete({ where: { id: invite.id } });
    throw err;
  }

  await writeLog({
    hanhDong: 'INVITE_USER',
    userId: requestedById,
    chiTiet: { email, hoTen, chucVu, donViIds, inviteId: invite.id },
  });

  return {
    id: invite.id,
    email: invite.email,
    hoTen: invite.hoTen,
    chucVu: invite.chucVu,
    donViIds: invite.donViIds,
    role: invite.role,
    status: invite.status,
    createdAt: invite.createdAt,
  };
}

/** GET /companies/employees — thành viên tài khoản (owner + nhân viên) kèm MST được cấp. */
export async function listCompanyEmployees(ownerId: string | null) {
  if (!ownerId) throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);

  return sysPrisma.user.findMany({
    where: { OR: [{ id: ownerId }, { ownerId }] },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      hoTen: true,
      email: true,
      sdt: true,
      chucVu: true,
      role: true,
      status: true,
      isActive: true,
      createdAt: true,
      donViAccess: { select: { donViId: true } },
    },
  });
}

/** GET /companies/invites — toàn bộ lời mời (mọi trạng thái) của tài khoản. */
export async function listCompanyInvites(ownerId: string | null) {
  if (!ownerId) throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);

  return sysPrisma.inviteRequest.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      hoTen: true,
      chucVu: true,
      donViIds: true,
      role: true,
      status: true,
      lyDoTuChoi: true,
      createdAt: true,
      resolvedAt: true,
    },
  });
}

/**
 * PUT /companies/employees/:userId/access — đặt lại tập MST của 1 nhân viên (replace-set).
 * donViIds rỗng = thu hồi hết. Chỉ owner của tài khoản thao tác; chỉ gán MST owner sở hữu.
 */
export async function setEmployeeAccess(
  ownerId: string,
  employeeId: string,
  donViIds: string[],
) {
  const employee = await sysPrisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, role: true, ownerId: true },
  });
  if (
    !employee ||
    employee.ownerId !== ownerId ||
    employee.role !== 'OWNER_EMPLOYEE'
  ) {
    throw new NotFoundError(MESSAGES.USER.NOT_FOUND);
  }

  // Chỉ gán được MST do owner sở hữu.
  if (donViIds.length > 0) {
    const owned = await sysPrisma.donVi.findMany({
      where: { id: { in: donViIds }, ownerId },
      select: { id: true },
    });
    if (owned.length !== donViIds.length) {
      throw new ForbiddenError(MESSAGES.COMPANY.NO_ACCESS);
    }
  }

  // Replace-set: xóa toàn bộ quyền cũ rồi cấp lại theo danh sách mới (1 INSERT).
  await sysPrisma.$transaction([
    sysPrisma.donViAccess.deleteMany({ where: { userId: employeeId } }),
    ...(donViIds.length > 0
      ? [
          sysPrisma.donViAccess.createMany({
            data: donViIds.map((donViId) => ({ userId: employeeId, donViId })),
          }),
        ]
      : []),
  ]);

  await writeLog({
    hanhDong: 'SET_EMPLOYEE_ACCESS',
    userId: ownerId,
    chiTiet: { employeeId, donViIds },
  });

  return { userId: employeeId, donViIds };
}

import { sysPrisma } from '../../config/db.sys';
import { generatePassword, hashPassword } from '../../utils/password';
import { sendMail } from '../shared/mailer.service';
import { inviteApprovedEmail } from '../../helpers/mailTemplates';
import { writeLog } from '../shared/syslog.service';
import { ConflictError, MailError, NotFoundError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type { Prisma } from '../../generated/sys';
import type {
  ListInvitesQuery,
  RejectInviteInput,
} from '../../validators/admin.validator';

/** Lấy lời mời PENDING theo id kèm người mời (owner), hoặc ném lỗi tương ứng. */
async function getPendingOrThrow(id: string) {
  const invite = await sysPrisma.inviteRequest.findUnique({
    where: { id },
    include: { owner: { select: { hoTen: true, email: true } } },
  });
  if (!invite) throw new NotFoundError(MESSAGES.COMPANY.INVITE_NOT_FOUND);
  if (invite.status !== 'PENDING') {
    throw new ConflictError(MESSAGES.COMPANY.INVITE_NOT_PENDING);
  }
  return invite;
}

/** GET /admin/invites — danh sách lời mời + lọc trạng thái/MST, phân trang. */
export async function adminListInvites(query: ListInvitesQuery) {
  const { status, donViId, page, pageSize } = query;

  const where: Prisma.InviteRequestWhereInput = {};
  if (status) where.status = status;
  if (donViId) where.donViIds = { has: donViId }; // lời mời có cấp MST này

  const [data, total] = await Promise.all([
    sysPrisma.inviteRequest.findMany({
      where,
      include: { owner: { select: { hoTen: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    sysPrisma.inviteRequest.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

/**
 * POST /admin/invites/:id/approve — tạo User thật cho nhân viên + gửi mật khẩu
 * ngẫu nhiên qua email. Gửi mail thất bại -> rollback toàn bộ (invite về lại PENDING).
 */
export async function adminApproveInvite(id: string, adminId: string) {
  const invite = await getPendingOrThrow(id);

  // 1 email = 1 tài khoản: email đã có user -> không tạo nhân viên trùng.
  const existingUser = await sysPrisma.user.findUnique({
    where: { email: invite.email },
  });
  if (existingUser) {
    throw new ConflictError(MESSAGES.COMPANY.EMAIL_ALREADY_MEMBER);
  }

  // Tên các MST được cấp (cho email chào mừng).
  const congTy = await sysPrisma.donVi.findMany({
    where: { id: { in: invite.donViIds } },
    select: { tenDonVi: true, maSoThue: true },
  });

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  const { user } = await sysPrisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: invite.email,
        hoTen: invite.hoTen,
        chucVu: invite.chucVu,
        password: passwordHash,
        role: 'OWNER_EMPLOYEE',
        status: 'ACTIVE',
        isActive: true,
        ownerId: invite.ownerId, // nhân viên thuộc tài khoản của owner
      },
    });
    // Cấp quyền vào từng MST được mời.
    if (invite.donViIds.length > 0) {
      await tx.donViAccess.createMany({
        data: invite.donViIds.map((donViId) => ({
          userId: createdUser.id,
          donViId,
        })),
      });
    }
    await tx.inviteRequest.update({
      where: { id: invite.id },
      data: { status: 'APPROVED', approvedById: adminId, resolvedAt: new Date() },
    });
    return { user: createdUser };
  });

  try {
    await sendMail({
      to: invite.email,
      ...inviteApprovedEmail({ email: invite.email, password, congTy }),
    });
  } catch {
    // Chưa ai biết mật khẩu -> hủy tạo User (cascade xóa DonViAccess), invite về lại PENDING.
    await sysPrisma.$transaction([
      sysPrisma.user.delete({ where: { id: user.id } }),
      sysPrisma.inviteRequest.update({
        where: { id: invite.id },
        data: { status: 'PENDING', approvedById: null, resolvedAt: null },
      }),
    ]);
    throw new MailError(MESSAGES.COMPANY.INVITE_WELCOME_MAIL_FAILED);
  }

  await writeLog({
    hanhDong: 'APPROVE_INVITE',
    userId: adminId,
    chiTiet: {
      inviteId: invite.id,
      newUserId: user.id,
      email: invite.email,
      ownerId: invite.ownerId,
      donViIds: invite.donViIds,
    },
  });

  return { id: user.id, email: user.email, hoTen: user.hoTen, chucVu: user.chucVu };
}

/** POST /admin/invites/:id/reject — từ chối, không tạo User, không gửi email. */
export async function adminRejectInvite(
  id: string,
  adminId: string,
  input: RejectInviteInput,
) {
  const invite = await getPendingOrThrow(id);

  const updated = await sysPrisma.inviteRequest.update({
    where: { id: invite.id },
    data: {
      status: 'REJECTED',
      approvedById: adminId,
      lyDoTuChoi: input.lyDoTuChoi,
      resolvedAt: new Date(),
    },
  });

  await writeLog({
    hanhDong: 'REJECT_INVITE',
    userId: adminId,
    chiTiet: {
      inviteId: invite.id,
      email: invite.email,
      ownerId: invite.ownerId,
      lyDo: input.lyDoTuChoi,
    },
  });

  return {
    id: updated.id,
    email: updated.email,
    status: updated.status,
    lyDoTuChoi: updated.lyDoTuChoi,
  };
}

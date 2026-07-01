import { sysPrisma } from '../../config/db.sys';
import { generatePassword, hashPassword } from '../../utils/password';
import { sendMail } from '../shared/mailer.service';
import { writeLog } from '../shared/syslog.service';
import { ConflictError, MailError, NotFoundError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type { Prisma } from '../../generated/sys';
import type {
  ListInvitesQuery,
  RejectInviteInput,
} from '../../validators/admin.validator';

/** Lấy lời mời PENDING theo id kèm thông tin công ty, hoặc ném lỗi tương ứng. */
async function getPendingOrThrow(id: string) {
  const invite = await sysPrisma.inviteRequest.findUnique({
    where: { id },
    include: { donVi: { select: { tenDonVi: true, maSoThue: true } } },
  });
  if (!invite) throw new NotFoundError(MESSAGES.COMPANY.INVITE_NOT_FOUND);
  if (invite.status !== 'PENDING') {
    throw new ConflictError(MESSAGES.COMPANY.INVITE_NOT_PENDING);
  }
  return invite;
}

/** GET /admin/invites — danh sách lời mời + lọc trạng thái/đơn vị, phân trang. */
export async function adminListInvites(query: ListInvitesQuery) {
  const { status, donViId, page, pageSize } = query;

  const where: Prisma.InviteRequestWhereInput = {};
  if (status) where.status = status;
  if (donViId) where.donViId = donViId;

  const [data, total] = await Promise.all([
    sysPrisma.inviteRequest.findMany({
      where,
      include: { donVi: { select: { tenDonVi: true, maSoThue: true } } },
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

  const existingUser = await sysPrisma.user.findUnique({
    where: { email: invite.email },
  });
  if (existingUser?.donViId) {
    throw new ConflictError(MESSAGES.COMPANY.EMAIL_ALREADY_MEMBER);
  }

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
        donViId: invite.donViId,
      },
    });
    await tx.inviteRequest.update({
      where: { id: invite.id },
      data: { status: 'APPROVED', approvedById: adminId, resolvedAt: new Date() },
    });
    return { user: createdUser };
  });

  try {
    await sendMail({
      to: invite.email,
      subject: 'Tài khoản nhân viên của bạn đã được duyệt',
      text: [
        `Công ty: ${invite.donVi.tenDonVi} (MST: ${invite.donVi.maSoThue})`,
        `Email đăng nhập: ${invite.email}`,
        `Mật khẩu: ${password}`,
        'Vui lòng đăng nhập và đổi mật khẩu ngay lần đầu sử dụng.',
      ].join('\n'),
    });
  } catch {
    // Chưa ai biết mật khẩu -> hủy tạo User, đưa invite về lại PENDING để admin duyệt lại.
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
    donViId: invite.donViId,
    chiTiet: { inviteId: invite.id, newUserId: user.id, email: invite.email },
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
    donViId: invite.donViId,
    chiTiet: { inviteId: invite.id, email: invite.email, lyDo: input.lyDoTuChoi },
  });

  return {
    id: updated.id,
    email: updated.email,
    status: updated.status,
    lyDoTuChoi: updated.lyDoTuChoi,
  };
}

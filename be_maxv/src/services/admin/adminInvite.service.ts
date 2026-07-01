import { sysPrisma } from '../../config/db.sys';
import { generatePassword, hashPassword } from '../../utils/password';
import { sendApprovedToEmployee } from '../shared/mailer.service';
import { writeLog } from '../shared/syslog.service';
import { ConflictError, NotFoundError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import { env } from '../../config/env';
import type { Prisma } from '../../generated/sys';
import type { ListInvitesQuery } from '../../validators/admin.validator';

const DON_VI_SELECT = {
  id: true,
  maSoThue: true,
  tenDonVi: true,
} satisfies Prisma.DonViSelect;

async function getInviteOrThrow(id: string) {
  const invite = await sysPrisma.inviteRequest.findUnique({
    where: { id },
    include: { donVi: { select: DON_VI_SELECT } },
  });
  if (!invite) throw new NotFoundError(MESSAGES.NHAN_VIEN.INVITE_NOT_FOUND);
  return invite;
}

/** Lấy invite + chặn nếu đã được xử lý — dùng chung cho approve/reject. */
async function getPendingInviteOrThrow(id: string) {
  const invite = await getInviteOrThrow(id);
  if (invite.status !== 'PENDING') {
    throw new ConflictError(MESSAGES.NHAN_VIEN.INVITE_NOT_PENDING);
  }
  return invite;
}

/** GET /api/v1/admin/nhan-vien */
export async function adminListInvites(query: ListInvitesQuery) {
  const { status, page, pageSize } = query;
  const where: Prisma.InviteRequestWhereInput = status ? { status } : {};

  const [rows, total] = await Promise.all([
    sysPrisma.inviteRequest.findMany({
      where,
      include: { donVi: { select: DON_VI_SELECT } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    sysPrisma.inviteRequest.count({ where }),
  ]);

  const requesterIds = [...new Set(rows.map((r) => r.requestedById))];
  const requesters = await sysPrisma.user.findMany({
    where: { id: { in: requesterIds } },
    select: { id: true, hoTen: true },
  });
  const requesterMap = new Map(requesters.map((r) => [r.id, r.hoTen]));

  const data = rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    status: r.status,
    lyDoTuChoi: r.lyDoTuChoi,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
    donVi: r.donVi,
    requestedBy: { id: r.requestedById, hoTen: requesterMap.get(r.requestedById) ?? '—' },
  }));

  return { data, total, page, pageSize };
}

/** POST /api/v1/admin/nhan-vien/:id/approve */
export async function adminApproveInvite(id: string, adminId: string) {
  const invite = await getPendingInviteOrThrow(id);

  const pendingUser = await sysPrisma.user.findUnique({ where: { email: invite.email } });
  if (!pendingUser) throw new ConflictError(MESSAGES.NHAN_VIEN.PENDING_USER_MISSING);

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  await sysPrisma.$transaction([
    sysPrisma.user.update({
      where: { id: pendingUser.id },
      data: { password: passwordHash, status: 'ACTIVE', isActive: true },
    }),
    sysPrisma.inviteRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: adminId, resolvedAt: new Date() },
    }),
  ]);

  // Gửi mail (best-effort, không throw — xem mailer.service.ts) và ghi log
  // độc lập với nhau -> chạy song song thay vì nối tiếp.
  await Promise.all([
    sendApprovedToEmployee({
      email: invite.email,
      companyName: invite.donVi.tenDonVi,
      tempPassword: password,
      loginUrl: `${env.appUrl}/login`,
    }),
    writeLog({
      hanhDong: 'APPROVE_INVITE',
      userId: adminId,
      donViId: invite.donViId,
      chiTiet: { email: invite.email },
    }),
  ]);

  return { email: invite.email, password };
}

/** POST /api/v1/admin/nhan-vien/:id/reject */
export async function adminRejectInvite(id: string, adminId: string, reason?: string) {
  const invite = await getPendingInviteOrThrow(id);

  await sysPrisma.$transaction([
    sysPrisma.user.updateMany({
      where: { email: invite.email, donViId: invite.donViId },
      data: { status: 'REJECTED' },
    }),
    sysPrisma.inviteRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        lyDoTuChoi: reason,
        approvedById: adminId,
        resolvedAt: new Date(),
      },
    }),
  ]);

  await writeLog({
    hanhDong: 'REJECT_INVITE',
    userId: adminId,
    donViId: invite.donViId,
    chiTiet: { email: invite.email, reason },
  });

  return { id, status: 'REJECTED' as const };
}

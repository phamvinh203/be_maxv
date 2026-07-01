import { sysPrisma } from '../../config/db.sys';
import { generatePassword, hashPassword } from '../../utils/password';
import { sendInviteNotifyToAdmins } from '../shared/mailer.service';
import { writeLog } from '../shared/syslog.service';
import { ConflictError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type { Prisma } from '../../generated/sys';
import type { InviteEmployeeInput } from '../../validators/nhanVien.validator';

const ROLE_LABELS: Record<string, string> = {
  KE_TOAN_TRUONG: 'Kế toán trưởng',
  KE_TOAN: 'Kế toán',
  XEM: 'Chỉ xem',
};

const EMPLOYEE_SELECT = {
  id: true,
  email: true,
  hoTen: true,
  role: true,
  status: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/**
 * POST /api/v1/nhan-vien/invite — owner mời nhân viên mới.
 * Tạo NGAY User(status=PENDING, isActive=false) + InviteRequest(status=PENDING)
 * trong 1 transaction. KHÔNG sinh/gửi mật khẩu thật ở bước này.
 */
export async function inviteEmployee(
  donViId: string,
  ownerId: string,
  input: InviteEmployeeInput,
) {
  const { email, role } = input;

  const existing = await sysPrisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError(MESSAGES.NHAN_VIEN.EMAIL_TAKEN);

  const hoTen = email.split('@')[0].toUpperCase();
  // Hash ngẫu nhiên KHÔNG dùng được — chỉ để chỗ cho tới khi admin duyệt.
  const dummyPassword = await hashPassword(generatePassword());

  const invite = await sysPrisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        email,
        hoTen,
        password: dummyPassword,
        role,
        status: 'PENDING',
        isActive: false,
        donViId,
      },
    });
    return tx.inviteRequest.create({
      data: { donViId, email, role, requestedById: ownerId, status: 'PENDING' },
    });
  });

  const [donVi, owner, admins] = await Promise.all([
    sysPrisma.donVi.findUnique({ where: { id: donViId }, select: { tenDonVi: true } }),
    sysPrisma.user.findUnique({ where: { id: ownerId }, select: { hoTen: true } }),
    sysPrisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } }),
  ]);

  await sendInviteNotifyToAdmins({
    adminEmails: admins.map((a) => a.email),
    companyName: donVi?.tenDonVi ?? 'Không rõ',
    ownerName: owner?.hoTen ?? 'Không rõ',
    inviteEmail: email,
    roleLabel: ROLE_LABELS[role] ?? role,
  }).catch(() => undefined);

  await writeLog({
    hanhDong: 'CREATE_INVITE',
    userId: ownerId,
    donViId,
    chiTiet: { email, role },
  });

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    createdAt: invite.createdAt,
  };
}

/** GET /api/v1/nhan-vien — danh sách nhân viên (User) của công ty mình. */
export async function listEmployees(donViId: string) {
  return sysPrisma.user.findMany({
    where: { donViId },
    select: EMPLOYEE_SELECT,
    orderBy: { createdAt: 'asc' },
  });
}

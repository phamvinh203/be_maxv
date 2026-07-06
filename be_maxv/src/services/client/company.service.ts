import { sysPrisma } from '../../config/db.sys';
import { tenantSlug } from '../../utils/dbName';
import { provisionTenant } from '../shared/provisioning.service';
import { createTrialSubscription } from '../shared/subscription.service';
import { writeLog } from '../shared/syslog.service';
import { sendMail } from '../shared/mailer.service';
import {
  ConflictError,
  ForbiddenError,
  MailError,
  NotFoundError,
} from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type { DonVi, InviteRequest } from '../../generated/sys';
import type { RegisterCompanyInput } from '../../validators/company.validator';
import type { InviteUserInput } from '../../validators/company.validator';

/** ownerId lấy từ JWT (req.user.userId) của owner đang đăng nhập, không nhận từ body. */
type RegisterCompanyArgs = RegisterCompanyInput & { ownerId: string };

/**
 * BƯỚC 2 — Owner đăng ký MỘT công ty/MST (có thể nhiều MST mỗi tài khoản).
 * Tạo don_vi (ownerId = owner) + cấp DB riêng maxv2_<mst>_app.
 * MST đầu tiên của owner -> tạo luôn thuê bao dùng thử cho tài khoản.
 */
export async function registerCompany(input: RegisterCompanyArgs) {
  const { ownerId, tenCongTy, maSoThue, diaChi, sdt, loaiHinhKinhDoanh } = input;

  // Đếm MST hiện có của owner + kiểm tra MST trùng + lấy gói để soát giới hạn.
  const [existingCount, mstExists, subscription] = await Promise.all([
    sysPrisma.donVi.count({ where: { ownerId } }),
    sysPrisma.donVi.findUnique({ where: { maSoThue } }),
    sysPrisma.subscription.findUnique({
      where: { ownerId },
      select: { plan: { select: { soMstToiDa: true } } },
    }),
  ]);

  if (mstExists) throw new ConflictError(MESSAGES.COMPANY.MST_TAKEN);

  // Giới hạn số MST theo gói (bỏ qua khi chưa có gói = đang tạo MST đầu tiên).
  const soMstToiDa = subscription?.plan.soMstToiDa ?? null;
  if (soMstToiDa !== null && existingCount >= soMstToiDa) {
    throw new ForbiddenError(MESSAGES.SUBSCRIPTION.MST_LIMIT_REACHED);
  }

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

  // MST đầu tiên của tài khoản -> tạo thuê bao dùng thử (best-effort).
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

interface InviteUserToCompanyInput extends InviteUserInput {
  donViId: string | null; // lấy từ JWT (req.user.donViId) của owner đang đăng nhập
  requestedById: string; // userId của owner gửi lời mời
}

/** Báo cho tất cả admin hệ thống có 1 lời mời nhân viên mới đang chờ duyệt. */
async function notifyAdminsOfNewInvite(
  donVi: DonVi,
  invite: InviteRequest,
  ownerHoTen: string,
): Promise<void> {
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
        `Công ty: ${donVi.tenDonVi} (MST: ${donVi.maSoThue})`,
        `Người gửi mời: ${ownerHoTen}`,
        `Nhân viên được mời: ${invite.hoTen} <${invite.email}>`,
        `Chức vụ: ${invite.chucVu}`,
      ].join('\n'),
    });
  } catch {
    throw new MailError(MESSAGES.COMPANY.INVITE_NOTIFY_FAILED);
  }
}

// BƯỚC 3 — Mời user vào công ty (owner gửi yêu cầu, admin duyệt)
// Mọi lời mời đều gán role = OWNER_EMPLOYEE; chức vụ cụ thể là text tự do (chucVu).
export async function inviteUserToCompany(input: InviteUserToCompanyInput) {
  const { donViId, requestedById, email, hoTen, chucVu } = input;

  if (!donViId) throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);

  const [donVi, owner, existingUser, pendingInvite] = await Promise.all([
    sysPrisma.donVi.findUnique({ where: { id: donViId } }),
    sysPrisma.user.findUnique({ where: { id: requestedById } }),
    sysPrisma.user.findUnique({ where: { email } }),
    sysPrisma.inviteRequest.findFirst({
      where: { donViId, email, status: 'PENDING' },
    }),
  ]);

  if (!donVi) throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);
  // User đã tồn tại và đã thuộc 1 công ty (kể cả chính công ty này) -> không mời lại.
  if (existingUser?.donViId) {
    throw new ConflictError(MESSAGES.COMPANY.EMAIL_ALREADY_MEMBER);
  }
  if (pendingInvite) {
    throw new ConflictError(MESSAGES.COMPANY.INVITE_ALREADY_PENDING);
  }

  const invite = await sysPrisma.inviteRequest.create({
    data: {
      donViId,
      email,
      hoTen,
      chucVu,
      role: 'OWNER_EMPLOYEE',
      requestedById,
    },
  });

  // Báo admin là yêu cầu bắt buộc — mail lỗi thì hủy luôn lời mời vừa tạo.
  try {
    await notifyAdminsOfNewInvite(donVi, invite, owner?.hoTen ?? '');
  } catch (err) {
    await sysPrisma.inviteRequest.delete({ where: { id: invite.id } });
    throw err;
  }

  await writeLog({
    hanhDong: 'INVITE_USER',
    userId: requestedById,
    donViId,
    chiTiet: { email, hoTen, chucVu, inviteId: invite.id },
  });

  return {
    id: invite.id,
    email: invite.email,
    hoTen: invite.hoTen,
    chucVu: invite.chucVu,
    role: invite.role,
    status: invite.status,
    createdAt: invite.createdAt,
  };
}

/** GET /companies/employees — danh sách nhân viên (kèm owner) của công ty đang đăng nhập. */
export async function listCompanyEmployees(donViId: string | null) {
  if (!donViId) throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);

  return sysPrisma.user.findMany({
    where: { donViId },
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
    },
  });
}

/** GET /companies/invites — toàn bộ lời mời (mọi trạng thái) của công ty đang đăng nhập. */
export async function listCompanyInvites(donViId: string | null) {
  if (!donViId) throw new NotFoundError(MESSAGES.COMPANY.NOT_FOUND);

  return sysPrisma.inviteRequest.findMany({
    where: { donViId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      hoTen: true,
      chucVu: true,
      role: true,
      status: true,
      lyDoTuChoi: true,
      createdAt: true,
      resolvedAt: true,
    },
  });
}

import { sysPrisma } from '../../config/db.sys';
import { ForbiddenError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type { Prisma } from '../../generated/sys';

export interface PlanLimits {
  soMstToiDa: number | null; // null = không giới hạn
  soNguoiToiDa: number | null;
}

/** Select tối thiểu để đọc giới hạn theo gói. */
export const PLAN_LIMITS_SELECT = {
  plan: { select: { soMstToiDa: true, soNguoiToiDa: true } },
} satisfies Prisma.SubscriptionSelect;

/**
 * Giới hạn theo gói của 1 subscription — chỉ để HIỂN THỊ (màn admin). `sub = null` ra toàn `null` nhưng
 * KHÔNG có nghĩa "không giới hạn" khi kiểm trần: `assertLimit` chặn thẳng owner không có gói.
 */
export function planLimits(
  sub: {
    plan: { soMstToiDa: number | null; soNguoiToiDa: number | null };
  } | null,
): PlanLimits {
  return {
    soMstToiDa: sub?.plan.soMstToiDa ?? null,
    soNguoiToiDa: sub?.plan.soNguoiToiDa ?? null,
  };
}

/**
 * Tuần tự hóa "đếm -> kiểm trần -> tạo" của MỘT owner cho một loại hạn mức, trong transaction đang
 * mở. Không khóa thì N request song song cùng đọc số đếm cũ, cùng qua kiểm tra, cùng tạo -> vượt gói.
 * Advisory lock tự nhả khi transaction kết thúc; owner khác (khóa khác) không phải chờ nhau.
 * Mọi chỗ đếm/tạo của cùng loại hạn mức PHẢI gọi hàm này trước khi đếm.
 */
export async function khoaHanMuc(
  tx: Prisma.TransactionClient,
  loai: 'mst' | 'nhan_vien',
  ownerId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`han_muc_${loai}:${ownerId}`}))`;
}

/**
 * Chặn nếu vượt trần gói (trần `null` của GÓI = không giới hạn) — dùng chung cho MST và nhân viên.
 *
 * Owner KHÔNG có thuê bao -> chặn (vbsec 2026-09-10). Trước đây coi là không giới hạn: owner mất gói (tạo
 * gói dùng thử lỗi lúc đăng ký, admin xóa thuê bao) tạo MST — mỗi MST là một DB tenant — và mời nhân
 * viên vô hạn. Tài khoản chưa có công ty nào được cấp gói dùng thử TRƯỚC khi gọi tới đây (registerCompany).
 */
async function assertLimit(
  ownerId: string,
  currentCount: number,
  field: keyof PlanLimits,
  message: string,
): Promise<void> {
  const sub = await sysPrisma.subscription.findUnique({
    where: { ownerId },
    select: PLAN_LIMITS_SELECT,
  });
  if (!sub) throw new ForbiddenError(MESSAGES.SUBSCRIPTION.NO_SUBSCRIPTION);
  const max = planLimits(sub)[field];
  if (max !== null && currentCount >= max) throw new ForbiddenError(message);
}

/** Chặn nếu tạo thêm MST sẽ vượt trần gói. */
export function assertMstLimit(
  ownerId: string,
  currentCount: number,
): Promise<void> {
  return assertLimit(
    ownerId,
    currentCount,
    'soMstToiDa',
    MESSAGES.SUBSCRIPTION.MST_LIMIT_REACHED,
  );
}

/** Chặn nếu thêm nhân viên sẽ vượt trần gói. */
export function assertUserLimit(
  ownerId: string,
  currentCount: number,
): Promise<void> {
  return assertLimit(
    ownerId,
    currentCount,
    'soNguoiToiDa',
    MESSAGES.SUBSCRIPTION.USER_LIMIT_REACHED,
  );
}

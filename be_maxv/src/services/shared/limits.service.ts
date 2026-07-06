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

/** Giới hạn theo gói của 1 subscription (null nếu chưa có gói). */
export function planLimits(
  sub: { plan: { soMstToiDa: number | null; soNguoiToiDa: number | null } } | null,
): PlanLimits {
  return {
    soMstToiDa: sub?.plan.soMstToiDa ?? null,
    soNguoiToiDa: sub?.plan.soNguoiToiDa ?? null,
  };
}

/**
 * Giới hạn của 1 TÀI KHOẢN (owner) theo gói đang dùng.
 * Chưa có subscription (chưa tạo công ty nào) -> không giới hạn (cho tạo MST đầu).
 */
export async function getPlanLimits(ownerId: string): Promise<PlanLimits> {
  const sub = await sysPrisma.subscription.findUnique({
    where: { ownerId },
    select: PLAN_LIMITS_SELECT,
  });
  return planLimits(sub);
}

/** Chặn nếu tạo thêm MST sẽ vượt trần gói (null = không giới hạn). */
export async function assertMstLimit(
  ownerId: string,
  currentCount: number,
): Promise<void> {
  const { soMstToiDa } = await getPlanLimits(ownerId);
  if (soMstToiDa !== null && currentCount >= soMstToiDa) {
    throw new ForbiddenError(MESSAGES.SUBSCRIPTION.MST_LIMIT_REACHED);
  }
}

/** Chặn nếu thêm nhân viên sẽ vượt trần gói (null = không giới hạn). */
export async function assertUserLimit(
  ownerId: string,
  currentCount: number,
): Promise<void> {
  const { soNguoiToiDa } = await getPlanLimits(ownerId);
  if (soNguoiToiDa !== null && currentCount >= soNguoiToiDa) {
    throw new ForbiddenError(MESSAGES.SUBSCRIPTION.USER_LIMIT_REACHED);
  }
}

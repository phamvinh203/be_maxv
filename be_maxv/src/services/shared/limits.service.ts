import { sysPrisma } from '../../config/db.sys';
import { ForbiddenError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type { Prisma } from '../../generated/sys';

export interface EffectiveLimits {
  soMstToiDa: number | null; // null = không giới hạn
  soNguoiToiDa: number | null;
}

/** Select tối thiểu để tính giới hạn hiệu lực (override + gói). */
export const SUBSCRIPTION_LIMITS_SELECT = {
  soMstToiDaOverride: true,
  soNguoiToiDaOverride: true,
  plan: { select: { soMstToiDa: true, soNguoiToiDa: true } },
} satisfies Prisma.SubscriptionSelect;

type SubscriptionLimits = {
  soMstToiDaOverride: number | null;
  soNguoiToiDaOverride: number | null;
} | null;

/** Tách giá trị override (do admin đặt) để hiển thị; null = chưa override. */
export function extractOverride(sub: SubscriptionLimits) {
  return {
    soMstToiDa: sub?.soMstToiDaOverride ?? null,
    soNguoiToiDa: sub?.soNguoiToiDaOverride ?? null,
  };
}

/** Tính giới hạn hiệu lực từ override (trên subscription) và giá trị gói. */
export function computeEffectiveLimits(
  sub:
    | (SubscriptionLimits & {
        plan: { soMstToiDa: number | null; soNguoiToiDa: number | null };
      })
    | null,
): EffectiveLimits {
  return {
    soMstToiDa: sub?.soMstToiDaOverride ?? sub?.plan.soMstToiDa ?? null,
    soNguoiToiDa: sub?.soNguoiToiDaOverride ?? sub?.plan.soNguoiToiDa ?? null,
  };
}

/**
 * Giới hạn hiệu lực của 1 TÀI KHOẢN (owner):
 *   override do admin đặt ?? giá trị theo gói ?? null (không giới hạn).
 * Chưa có subscription (chưa tạo công ty nào) -> không giới hạn (cho tạo MST đầu).
 */
export async function getEffectiveLimits(
  ownerId: string,
): Promise<EffectiveLimits> {
  const sub = await sysPrisma.subscription.findUnique({
    where: { ownerId },
    select: SUBSCRIPTION_LIMITS_SELECT,
  });
  return computeEffectiveLimits(sub);
}

/** Chặn nếu tạo thêm MST sẽ vượt trần (null = không giới hạn). */
export async function assertMstLimit(
  ownerId: string,
  currentCount: number,
): Promise<void> {
  const { soMstToiDa } = await getEffectiveLimits(ownerId);
  if (soMstToiDa !== null && currentCount >= soMstToiDa) {
    throw new ForbiddenError(MESSAGES.SUBSCRIPTION.MST_LIMIT_REACHED);
  }
}

/** Chặn nếu thêm nhân viên sẽ vượt trần (null = không giới hạn). */
export async function assertUserLimit(
  ownerId: string,
  currentCount: number,
): Promise<void> {
  const { soNguoiToiDa } = await getEffectiveLimits(ownerId);
  if (soNguoiToiDa !== null && currentCount >= soNguoiToiDa) {
    throw new ForbiddenError(MESSAGES.SUBSCRIPTION.USER_LIMIT_REACHED);
  }
}

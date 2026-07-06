import { sysPrisma } from '../../config/db.sys';

export interface EffectiveLimits {
  soMstToiDa: number | null; // null = không giới hạn
  soNguoiToiDa: number | null;
}

/** Tính giới hạn hiệu lực từ override (trên subscription) và giá trị gói. */
export function computeEffectiveLimits(sub: {
  soMstToiDaOverride: number | null;
  soNguoiToiDaOverride: number | null;
  plan: { soMstToiDa: number | null; soNguoiToiDa: number | null };
} | null): EffectiveLimits {
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
    select: {
      soMstToiDaOverride: true,
      soNguoiToiDaOverride: true,
      plan: { select: { soMstToiDa: true, soNguoiToiDa: true } },
    },
  });
  return computeEffectiveLimits(sub);
}

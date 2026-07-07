import { sysPrisma } from '../../config/db.sys';
import { env } from '../../config/env';
import type { SubscriptionPlan } from '../../generated/sys';

/**
 * Đảm bảo có gói TRIAL trong DB (idempotent).
 * Không cache trong process: chỉ chạy ở path hiếm (đăng ký công ty) và đọc
 * trực tiếp DB để luôn phản ánh cấu hình gói mới nhất (giá, số người tối đa).
 */
async function ensureTrialPlan(): Promise<SubscriptionPlan> {
  return sysPrisma.subscriptionPlan.upsert({
    where: { ma: 'TRIAL' },
    update: {},
    create: {
      ma: 'TRIAL',
      ten: 'Dùng thử',
      gia: 0,
      chuKyThang: 0,
      soMstToiDa: 3,
      soNguoiToiDa: 3,
    },
  });
}

/**
 * Tạo thuê bao dùng thử cho 1 TÀI KHOẢN (owner) mới + ghi lịch sử.
 * Gọi ngay khi đăng ký tài khoản; trial = env.trialDays ngày kể từ bây giờ.
 *
 * IDEMPOTENT: mỗi owner chỉ 1 thuê bao (Subscription.ownerId @unique) — nếu đã
 * có thì trả về luôn, không tạo trùng / không ghi thêm lịch sử. Nhờ vậy lời gọi
 * lưới an toàn ở bước tạo công ty (cho tài khoản cũ) là no-op an toàn.
 */
export async function createTrialSubscription(ownerId: string) {
  const existing = await sysPrisma.subscription.findUnique({
    where: { ownerId },
  });
  if (existing) return existing;

  const plan = await ensureTrialPlan();
  const ketThuc = new Date(Date.now() + env.trialDays * 24 * 60 * 60 * 1000);

  // Transaction: tránh để lại subscription không có lịch sử nếu insert lịch sử lỗi
  // (idempotency check ở trên sẽ không bao giờ backfill lịch sử bị thiếu).
  return sysPrisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: { ownerId, planId: plan.id, status: 'TRIALING', ketThuc },
    });

    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        ownerId,
        planId: plan.id,
        hanhDong: 'CREATE_TRIAL',
        ghiChu: `Tạo gói dùng thử ${env.trialDays} ngày`,
      },
    });

    return sub;
  });
}

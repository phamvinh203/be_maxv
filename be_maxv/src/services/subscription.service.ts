import { sysPrisma } from '../config/db.sys';
import { env } from '../config/env';
import type { SubscriptionPlan } from '../generated/sys';

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
      soNguoiToiDa: 3,
    },
  });
}

/**
 * Tạo thuê bao dùng thử cho 1 công ty mới + ghi lịch sử.
 * trial = env.trialDays ngày kể từ bây giờ.
 */
export async function createTrialSubscription(donViId: string) {
  const plan = await ensureTrialPlan();
  const ketThuc = new Date(Date.now() + env.trialDays * 24 * 60 * 60 * 1000);

  const sub = await sysPrisma.subscription.create({
    data: {
      donViId,
      planId: plan.id,
      status: 'TRIALING',
      ketThuc,
    },
  });

  await sysPrisma.subscriptionHistory.create({
    data: {
      subscriptionId: sub.id,
      donViId,
      planId: plan.id,
      hanhDong: 'CREATE_TRIAL',
      ghiChu: `Tạo gói dùng thử ${env.trialDays} ngày`,
    },
  });

  return sub;
}

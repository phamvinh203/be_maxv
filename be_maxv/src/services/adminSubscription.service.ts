import { sysPrisma } from '../config/db.sys';
import { writeLog } from './syslog.service';
import { ConflictError, NotFoundError } from '../helpers/errors';
import { MESSAGES } from '../constants/messages';
import type { Prisma } from '../generated/sys';
import type {
  CreatePlanInput,
  UpdatePlanInput,
  ListSubscriptionsQuery,
  ChangePlanInput,
} from '../validators/admin.validator';

/** Cộng `months` tháng vào 1 mốc thời gian. */
function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

// ============ GÓI DỊCH VỤ (subscription_plans) ============

/** GET /admin/plans — toàn bộ gói (kể cả ngừng bán). */
export function adminListPlans() {
  return sysPrisma.subscriptionPlan.findMany({ orderBy: { gia: 'asc' } });
}

/** POST /admin/plans — tạo gói mới. */
export async function adminCreatePlan(input: CreatePlanInput) {
  const existing = await sysPrisma.subscriptionPlan.findUnique({
    where: { ma: input.ma },
  });
  if (existing) throw new ConflictError(MESSAGES.SUBSCRIPTION.PLAN_CODE_TAKEN);

  return sysPrisma.subscriptionPlan.create({
    data: {
      ma: input.ma,
      ten: input.ten,
      gia: input.gia,
      chuKyThang: input.chuKyThang,
      soNguoiToiDa: input.soNguoiToiDa ?? null,
      isActive: input.isActive,
    },
  });
}

/** PATCH /admin/plans/:id — cập nhật gói (không đổi mã). */
export async function adminUpdatePlan(id: string, input: UpdatePlanInput) {
  const plan = await sysPrisma.subscriptionPlan.findUnique({ where: { id } });
  if (!plan) throw new NotFoundError(MESSAGES.SUBSCRIPTION.PLAN_NOT_FOUND);

  // Prisma bỏ qua field `undefined` và áp dụng `null` literal -> truyền thẳng input
  // (zod đã strip key lạ; soNguoiToiDa null = xóa giới hạn là chủ đích).
  return sysPrisma.subscriptionPlan.update({ where: { id }, data: input });
}

// ============ THUÊ BAO (subscription) ============

const SUB_INCLUDE = {
  donVi: { select: { id: true, maSoThue: true, tenDonVi: true, status: true } },
  plan: { select: { id: true, ma: true, ten: true, gia: true } },
} satisfies Prisma.SubscriptionInclude;

/** GET /admin/subscriptions — danh sách + lọc trạng thái/đơn vị, phân trang. */
export async function adminListSubscriptions(query: ListSubscriptionsQuery) {
  const { status, q, page, pageSize } = query;

  const where: Prisma.SubscriptionWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.donVi = {
      OR: [
        { maSoThue: { contains: q } },
        { tenDonVi: { contains: q, mode: 'insensitive' } },
      ],
    };
  }

  const [data, total] = await Promise.all([
    sysPrisma.subscription.findMany({
      where,
      include: SUB_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    sysPrisma.subscription.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

/** POST /admin/subscriptions/:id/change-plan — đổi gói + ghi lịch sử. */
export async function adminChangePlan(
  id: string,
  input: ChangePlanInput,
  adminId: string,
) {
  const sub = await sysPrisma.subscription.findUnique({ where: { id } });
  if (!sub) throw new NotFoundError(MESSAGES.SUBSCRIPTION.SUB_NOT_FOUND);
  if (sub.planId === input.planId) {
    throw new ConflictError(MESSAGES.SUBSCRIPTION.SAME_PLAN);
  }

  const plan = await sysPrisma.subscriptionPlan.findUnique({
    where: { id: input.planId },
  });
  if (!plan) throw new NotFoundError(MESSAGES.SUBSCRIPTION.PLAN_NOT_FOUND);

  const now = new Date();
  const ketThuc = plan.chuKyThang > 0 ? addMonths(now, plan.chuKyThang) : null;

  // Đổi gói = chu kỳ mới: cập nhật sub + ghi history trong 1 transaction.
  const updated = await sysPrisma.$transaction(async (tx) => {
    const next = await tx.subscription.update({
      where: { id },
      data: { planId: plan.id, status: 'ACTIVE', batDau: now, ketThuc },
      include: SUB_INCLUDE,
    });
    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: id,
        donViId: sub.donViId,
        planId: plan.id,
        hanhDong: 'CHANGE_PLAN',
        giaTri: plan.gia,
        ghiChu: input.ghiChu,
      },
    });
    return next;
  });

  await writeLog({
    hanhDong: 'CHANGE_PLAN',
    userId: adminId,
    donViId: sub.donViId,
    chiTiet: { planMa: plan.ma },
  });
  return updated;
}

/** POST /admin/subscriptions/:id/cancel — hủy thuê bao + ghi lịch sử. */
export async function adminCancelSubscription(id: string, adminId: string) {
  const sub = await sysPrisma.subscription.findUnique({ where: { id } });
  if (!sub) throw new NotFoundError(MESSAGES.SUBSCRIPTION.SUB_NOT_FOUND);
  if (sub.status === 'CANCELED') {
    throw new ConflictError(MESSAGES.SUBSCRIPTION.ALREADY_CANCELED);
  }

  const updated = await sysPrisma.$transaction(async (tx) => {
    const next = await tx.subscription.update({
      where: { id },
      data: { status: 'CANCELED' },
      include: SUB_INCLUDE,
    });
    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: id,
        donViId: sub.donViId,
        planId: sub.planId,
        hanhDong: 'CANCEL',
      },
    });
    return next;
  });

  await writeLog({ hanhDong: 'CANCEL_SUBSCRIPTION', userId: adminId, donViId: sub.donViId });
  return updated;
}

/**
 * GET /admin/subscriptions/:id/history — lịch sử thuê bao.
 * Không cần check tồn tại trước: mảng rỗng đã là tín hiệu "không có",
 * tiết kiệm 1 round-trip (history luôn mở từ 1 dòng trong danh sách).
 */
export async function adminListSubscriptionHistory(id: string) {
  return sysPrisma.subscriptionHistory.findMany({
    where: { subscriptionId: id },
    include: { plan: { select: { ma: true, ten: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

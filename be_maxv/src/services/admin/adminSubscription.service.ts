import { sysPrisma } from '../../config/db.sys';
import { writeLog } from '../shared/syslog.service';
import { ConflictError, NotFoundError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import { Prisma } from '../../generated/sys';
import type {
  CreatePlanInput,
  UpdatePlanInput,
  ListSubscriptionsQuery,
  ChangePlanInput,
} from '../../validators/admin.validator';
// Quy tắc tính hạn nằm ở `shared/subscription.service` — MỘT bản duy nhất dùng chung
// với đường đăng ký. Chép lại một bản `addMonths` ở đây là cách hai đường trôi lệch.
import {
  tinhKetThuc,
  mocGiaHan,
  hanMoiKhiDoiGoi,
} from '../shared/subscription.service';

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
      soMstToiDa: input.soMstToiDa ?? null,
      soNguoiToiDa: input.soNguoiToiDa ?? null,
      isActive: input.isActive,
      features: input.features,
    },
  });
}

/**
 * PATCH /admin/plans/:id — cập nhật gói (không đổi mã), rồi ÁP LẠI HẠN cho thuê bao của gói.
 *
 * ===== VÌ SAO SỬA GÓI PHẢI CHẠM VÀO THUÊ BAO =====
 *
 * `chuKyThang` trước đây chỉ được đọc ở thời điểm tạo/đổi gói, nên sửa nó chẳng ảnh hưởng ai
 * đang dùng: admin kéo dài gói TRIAL từ 0 lên 12 tháng mà 7 thuê bao TRIAL vẫn hết hạn từ
 * 27/07/2026, khách mất sạch module còn màn admin thì không có dấu hiệu gì (đo thật 04/09/2026).
 * Sửa gói mà người đang dùng gói không thấy gì đổi là một cái bẫy, không phải một tính năng.
 *
 * Quy tắc áp nằm ở `hanMoiKhiDoiGoi` (hàm thuần, test riêng): mốc là `batDau`, và **chỉ kéo
 * dài, không bao giờ rút ngắn** — khách đã gia hạn nhiều lần không bị xén mất tháng đã trả.
 * Thuê bao `CANCELED` đứng ngoài: hủy là quyết định nghiệp vụ, sửa gói không được lặng lẽ
 * hồi sinh nó.
 *
 * Trả kèm `soThueBaoDoiHan` để màn admin nói được "đã cập nhật N thuê bao" — im lặng ở đây
 * nghĩa là admin không bao giờ biết thao tác của mình vừa chạm vào bao nhiêu khách hàng.
 */
export async function adminUpdatePlan(id: string, input: UpdatePlanInput) {
  const plan = await sysPrisma.subscriptionPlan.findUnique({ where: { id } });
  if (!plan) throw new NotFoundError(MESSAGES.SUBSCRIPTION.PLAN_NOT_FOUND);

  // Prisma bỏ qua field `undefined` và áp dụng `null` literal -> truyền thẳng input
  // (zod đã strip key lạ; soNguoiToiDa null = xóa giới hạn là chủ đích).
  const capNhat = await sysPrisma.subscriptionPlan.update({
    where: { id },
    data: input,
  });

  // `undefined` = admin không đụng tới ô chu kỳ -> không việc gì phải quét thuê bao.
  if (input.chuKyThang === undefined) return { ...capNhat, soThueBaoDoiHan: 0 };

  const dsSub = await sysPrisma.subscription.findMany({
    where: { planId: id, status: { not: 'CANCELED' } },
    select: { id: true, ownerId: true, batDau: true, ketThuc: true },
  });

  const canDoi = dsSub
    .map((s) => ({ sub: s, han: hanMoiKhiDoiGoi(s, capNhat.chuKyThang) }))
    .filter((x): x is { sub: (typeof dsSub)[number]; han: { ketThuc: Date | null } } =>
      x.han !== null,
    );
  if (canDoi.length === 0) return { ...capNhat, soThueBaoDoiHan: 0 };

  // Mỗi thuê bao một `update` vì `ketThuc` khác nhau theo `batDau` của từng người —
  // `updateMany` chỉ đặt được một giá trị chung. Gói lại trong MỘT transaction để không
  // có trạng thái nửa vời: hoặc mọi thuê bao đổi hạn, hoặc không ai đổi.
  await sysPrisma.$transaction([
    ...canDoi.map((x) =>
      sysPrisma.subscription.update({
        where: { id: x.sub.id },
        data: { ketThuc: x.han.ketThuc },
      }),
    ),
    ...canDoi.map((x) =>
      sysPrisma.subscriptionHistory.create({
        data: {
          subscriptionId: x.sub.id,
          ownerId: x.sub.ownerId,
          planId: id,
          hanhDong: 'RENEW',
          ghiChu: `Gói "${capNhat.ma}" đổi chu kỳ thành ${capNhat.chuKyThang} tháng — hạn dời tới ${
            x.han.ketThuc ? x.han.ketThuc.toISOString().slice(0, 10) : 'không giới hạn'
          }`,
        },
      }),
    ),
  ]);

  return { ...capNhat, soThueBaoDoiHan: canDoi.length };
}

/**
 * Luật xóa gói: còn BẤT KỲ tham chiếu nào (thuê bao hiện hành hoặc lịch sử) thì
 * không xóa cứng — chỉ được ngừng bán. Tách khỏi phần đụng Prisma để test riêng.
 */
export function assertPlanDeletable(counts: {
  subscriptions: number;
  histories: number;
}): void {
  if (counts.subscriptions > 0 || counts.histories > 0) {
    throw new ConflictError(MESSAGES.SUBSCRIPTION.PLAN_IN_USE);
  }
}

/**
 * DELETE /admin/plans/:id — chỉ xóa cứng gói CHƯA từng được dùng.
 * FK từ subscription/history về plan là Restrict (mặc định), nên gói đã có thuê bao
 * hoặc đã nằm trong lịch sử sẽ bị DB chặn: chặn sớm ở đây để trả 409 kèm hướng dẫn
 * (chuyển isActive=false) thay vì để Prisma ném lỗi thô.
 */
export async function adminDeletePlan(id: string, adminId: string) {
  const plan = await sysPrisma.subscriptionPlan.findUnique({
    where: { id },
    include: { _count: { select: { subscriptions: true, histories: true } } },
  });
  if (!plan) throw new NotFoundError(MESSAGES.SUBSCRIPTION.PLAN_NOT_FOUND);
  assertPlanDeletable(plan._count);

  try {
    await sysPrisma.subscriptionPlan.delete({ where: { id } });
  } catch (err) {
    // Kẽ hở giữa lúc đếm và lúc xóa: có thuê bao vừa trỏ vào gói này -> FK chặn.
    // Ánh xạ về đúng 409 như trên thay vì để rơi xuống 500.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2003'
    ) {
      throw new ConflictError(MESSAGES.SUBSCRIPTION.PLAN_IN_USE);
    }
    throw err;
  }

  await writeLog({
    hanhDong: 'DELETE_PLAN',
    userId: adminId,
    chiTiet: { planId: id, planMa: plan.ma, planTen: plan.ten },
  });
  return { id };
}

// ============ THUÊ BAO (subscription) ============

const SUB_INCLUDE = {
  owner: {
    select: {
      id: true,
      hoTen: true,
      email: true,
      _count: { select: { ownedDonVi: true } },
    },
  },
  plan: { select: { id: true, ma: true, ten: true, gia: true } },
} satisfies Prisma.SubscriptionInclude;

/** GET /admin/subscriptions — danh sách + lọc trạng thái/tài khoản, phân trang. */
export async function adminListSubscriptions(query: ListSubscriptionsQuery) {
  const { status, q, page, pageSize } = query;

  const where: Prisma.SubscriptionWhereInput = {};
  if (status) where.status = status;
  // Tìm theo chủ tài khoản (tên/email) hoặc theo MST của tài khoản đó.
  if (q) {
    where.owner = {
      OR: [
        { hoTen: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { ownedDonVi: { some: { maSoThue: { contains: q } } } },
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
  const ketThuc = tinhKetThuc(plan.chuKyThang, now);

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
        ownerId: sub.ownerId,
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
    chiTiet: { ownerId: sub.ownerId, planMa: plan.ma },
  });
  return updated;
}

/**
 * POST /admin/subscriptions/:id/renew — GIA HẠN thuê bao theo chu kỳ của chính gói nó đang dùng.
 *
 * Khác `adminChangePlan` ở chỗ KHÔNG đổi gói, nên dùng được cho thuê bao đã hết hạn mà vẫn muốn
 * giữ nguyên gói — đường mà trước đây không có: `adminChangePlan` chặn `SAME_PLAN`, nên muốn gia
 * hạn phải đổi sang gói khác rồi đổi ngược về, để lại hai dòng lịch sử vô nghĩa.
 *
 * Mốc cộng thêm do `mocGiaHan` quyết: còn hạn thì nối vào `ketThuc` cũ, hết hạn rồi thì tính từ
 * bây giờ. Gói có `chuKyThang = 0` (không hết hạn) thì `ketThuc` về `null`.
 *
 * Đặt lại `status` về `ACTIVE`: một thuê bao vừa được trả tiền gia hạn không còn là `TRIALING`
 * hay `PAST_DUE` nữa. Thuê bao đã `CANCELED` thì phải mở lại bằng đổi gói, không gia hạn ngang —
 * hủy là quyết định nghiệp vụ, gia hạn không được lặng lẽ đảo ngược nó.
 */
export async function adminRenewSubscription(id: string, adminId: string) {
  const sub = await sysPrisma.subscription.findUnique({
    where: { id },
    include: { plan: { select: { ma: true, gia: true, chuKyThang: true } } },
  });
  if (!sub) throw new NotFoundError(MESSAGES.SUBSCRIPTION.SUB_NOT_FOUND);
  if (sub.status === 'CANCELED') {
    throw new ConflictError(MESSAGES.SUBSCRIPTION.CANCELED_CANNOT_RENEW);
  }

  const now = new Date();
  const ketThuc = tinhKetThuc(sub.plan.chuKyThang, mocGiaHan(sub.ketThuc, now));

  const updated = await sysPrisma.$transaction(async (tx) => {
    const next = await tx.subscription.update({
      where: { id },
      // `batDau` GIỮ NGUYÊN: nó là ngày khách bắt đầu dùng gói này, không phải ngày
      // lần gia hạn gần nhất — ghi đè là mất mốc để tính khách đã gắn bó bao lâu.
      data: { status: 'ACTIVE', ketThuc },
      include: SUB_INCLUDE,
    });
    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: id,
        ownerId: sub.ownerId,
        planId: sub.planId,
        hanhDong: 'RENEW',
        giaTri: sub.plan.gia,
        ghiChu: ketThuc
          ? `Gia hạn ${sub.plan.chuKyThang} tháng, hết hạn ${ketThuc.toISOString().slice(0, 10)}`
          : 'Gia hạn: gói không giới hạn thời gian',
      },
    });
    return next;
  });

  await writeLog({
    hanhDong: 'RENEW_SUBSCRIPTION',
    userId: adminId,
    chiTiet: { ownerId: sub.ownerId, planMa: sub.plan.ma },
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
        ownerId: sub.ownerId,
        planId: sub.planId,
        hanhDong: 'CANCEL',
      },
    });
    return next;
  });

  await writeLog({
    hanhDong: 'CANCEL_SUBSCRIPTION',
    userId: adminId,
    chiTiet: { ownerId: sub.ownerId },
  });
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

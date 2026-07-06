import { sysPrisma } from '../../config/db.sys';
import { writeLog } from '../shared/syslog.service';
import {
  computeEffectiveLimits,
  extractOverride,
  SUBSCRIPTION_LIMITS_SELECT,
} from '../shared/limits.service';
import { ConflictError, NotFoundError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type { Prisma } from '../../generated/sys';
import type {
  ListOwnersQuery,
  SetOwnerLimitsInput,
} from '../../validators/admin.validator';

/** Dung lượng (bytes) của các DB tenant còn tồn tại thật trong PostgreSQL. */
async function dbSizes(dbNames: string[]): Promise<Map<string, number>> {
  if (dbNames.length === 0) return new Map();
  const rows = await sysPrisma.$queryRaw<{ datname: string; size: number }[]>`
    SELECT datname, pg_database_size(datname)::float8 AS size
    FROM pg_database WHERE datname = ANY(${dbNames})
  `;
  return new Map(rows.map((r) => [r.datname, r.size]));
}

/** GET /admin/owners — danh sách tài khoản (owner) + số MST/nhân viên + giới hạn hiệu lực. */
export async function adminListOwners(query: ListOwnersQuery) {
  const { q, page, pageSize } = query;

  const where: Prisma.UserWhereInput = { role: 'OWNER' };
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { hoTen: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    sysPrisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        hoTen: true,
        email: true,
        status: true,
        createdAt: true,
        _count: { select: { ownedDonVi: true, employees: true } },
        subscription: {
          select: {
            status: true,
            soMstToiDaOverride: true,
            soNguoiToiDaOverride: true,
            plan: {
              select: {
                ma: true,
                ten: true,
                soMstToiDa: true,
                soNguoiToiDa: true,
              },
            },
          },
        },
      },
    }),
    sysPrisma.user.count({ where }),
  ]);

  const data = rows.map((o) => ({
    id: o.id,
    hoTen: o.hoTen,
    email: o.email,
    status: o.status,
    createdAt: o.createdAt,
    soCongTy: o._count.ownedDonVi,
    soNhanVien: o._count.employees,
    plan: o.subscription
      ? { ma: o.subscription.plan.ma, ten: o.subscription.plan.ten }
      : null,
    gioiHan: computeEffectiveLimits(o.subscription),
    override: extractOverride(o.subscription),
  }));

  return { data, total, page, pageSize };
}

/** GET /admin/owners/:id — chi tiết 1 tài khoản: MST/DB (kèm dung lượng) + nhân viên. */
export async function adminGetOwner(id: string) {
  const owner = await sysPrisma.user.findFirst({
    where: { id, role: 'OWNER' },
    select: {
      id: true,
      hoTen: true,
      email: true,
      sdt: true,
      status: true,
      createdAt: true,
      subscription: {
        select: {
          status: true,
          batDau: true,
          ketThuc: true,
          soMstToiDaOverride: true,
          soNguoiToiDaOverride: true,
          plan: {
            select: {
              ma: true,
              ten: true,
              soMstToiDa: true,
              soNguoiToiDa: true,
            },
          },
        },
      },
      ownedDonVi: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          maSoThue: true,
          tenDonVi: true,
          status: true,
          dbName: true,
          provisionedAt: true,
        },
      },
      employees: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          hoTen: true,
          email: true,
          chucVu: true,
          status: true,
          isActive: true,
          donViAccess: { select: { donViId: true } },
        },
      },
    },
  });
  if (!owner) throw new NotFoundError(MESSAGES.USER.NOT_FOUND);

  const sizes = await dbSizes(
    owner.ownedDonVi
      .map((c) => c.dbName)
      .filter((n): n is string => n !== null),
  );
  const congTy = owner.ownedDonVi.map((c) => ({
    ...c,
    dbSizeBytes: c.dbName ? (sizes.get(c.dbName) ?? null) : null,
    dbExists: c.dbName ? sizes.has(c.dbName) : false, // DB có tồn tại thật không (reconcile)
  }));
  const tongDbBytes = congTy.reduce((s, c) => s + (c.dbSizeBytes ?? 0), 0);

  return {
    id: owner.id,
    hoTen: owner.hoTen,
    email: owner.email,
    sdt: owner.sdt,
    status: owner.status,
    createdAt: owner.createdAt,
    subscription: owner.subscription,
    gioiHan: computeEffectiveLimits(owner.subscription),
    override: extractOverride(owner.subscription),
    soCongTy: congTy.length,
    soNhanVien: owner.employees.length,
    tongDbBytes,
    congTy,
    nhanVien: owner.employees,
  };
}

/**
 * PATCH /admin/owners/:id/limits — admin đặt giới hạn RIÊNG cho owner (ghi đè gói).
 * Truyền null cho 1 field = xóa override (quay lại theo gói); bỏ field = giữ nguyên.
 * Yêu cầu owner đã có subscription (đã tạo ≥1 công ty).
 */
export async function adminSetOwnerLimits(
  id: string,
  input: SetOwnerLimitsInput,
  adminId: string,
) {
  const owner = await sysPrisma.user.findFirst({
    where: { id, role: 'OWNER' },
    select: { id: true, subscription: { select: { id: true } } },
  });
  if (!owner) throw new NotFoundError(MESSAGES.USER.NOT_FOUND);
  if (!owner.subscription) {
    throw new ConflictError(MESSAGES.SUBSCRIPTION.NO_SUBSCRIPTION);
  }

  const data: Prisma.SubscriptionUpdateInput = {};
  if (input.soMstToiDaOverride !== undefined) {
    data.soMstToiDaOverride = input.soMstToiDaOverride;
  }
  if (input.soNguoiToiDaOverride !== undefined) {
    data.soNguoiToiDaOverride = input.soNguoiToiDaOverride;
  }

  const updated = await sysPrisma.subscription.update({
    where: { ownerId: id },
    data,
    select: SUBSCRIPTION_LIMITS_SELECT,
  });

  const chiTiet = {
    ownerId: id,
    ...(input.soMstToiDaOverride !== undefined && {
      soMstToiDaOverride: input.soMstToiDaOverride,
    }),
    ...(input.soNguoiToiDaOverride !== undefined && {
      soNguoiToiDaOverride: input.soNguoiToiDaOverride,
    }),
  };
  await writeLog({ hanhDong: 'SET_OWNER_LIMITS', userId: adminId, chiTiet });

  return {
    ownerId: id,
    override: extractOverride(updated),
    gioiHan: computeEffectiveLimits(updated),
  };
}

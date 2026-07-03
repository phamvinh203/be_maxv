import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import type { ThueListQuery } from '../../../../validators/tonKho/thue.validator';

/** GET danh sách thuế GTGT (dmthue) — chỉ bản ghi đang dùng. */
export function listThue(db: PrismaClient, q: ThueListQuery) {
  const and: Prisma.dmthueWhereInput[] = [{ status: '1' }];
  if (q.ma_thue)
    and.push({ ma_thue: { contains: q.ma_thue, mode: 'insensitive' } });
  if (q.ten_thue)
    and.push({ ten_thue: { contains: q.ten_thue, mode: 'insensitive' } });

  return db.dmthue.findMany({
    where: { AND: and },
    select: {
      ma_thue: true,
      ten_thue: true,
      ten_thue2: true,
      ty_le: true,
      tk_thue: true,
      status: true,
    },
    orderBy: { ma_thue: 'asc' },
  });
}

/** GET danh sách thuế nhập khẩu (dmthuenk) — chỉ bản ghi đang dùng. */
export function listThueNk(db: PrismaClient, q: ThueListQuery) {
  const and: Prisma.dmthuenkWhereInput[] = [{ status: '1' }];
  if (q.ma_thue)
    and.push({ ma_thue: { contains: q.ma_thue, mode: 'insensitive' } });
  if (q.ten_thue)
    and.push({ ten_thue: { contains: q.ten_thue, mode: 'insensitive' } });

  return db.dmthuenk.findMany({
    where: { AND: and },
    select: {
      ma_thue: true,
      ten_thue: true,
      ten_thue2: true,
      thue_suat: true,
      tk_thue: true,
      status: true,
    },
    orderBy: { ma_thue: 'asc' },
  });
}

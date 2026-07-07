import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../constants/messages';
import type {
  PhongBanBodyInput,
  PhongBanListQuery,
  PhongBanUpdateInput,
} from '../../../../validators/tongHop/phongBan.validator';

/** GET danh sách + lọc theo ma_pb / ten_pb. */
export function listPhongBan(db: PrismaClient, q: PhongBanListQuery) {
  const and: Prisma.dmpbWhereInput[] = [];
  if (q.ma_pb) and.push({ ma_pb: { contains: q.ma_pb, mode: 'insensitive' } });
  if (q.ten_pb)
    and.push({ ten_pb: { contains: q.ten_pb, mode: 'insensitive' } });

  return db.dmpb.findMany({
    where: and.length ? { AND: and } : undefined,
    orderBy: { ma_pb: 'asc' },
  });
}

/** POST tạo mới. */
export async function createPhongBan(
  db: PrismaClient,
  body: PhongBanBodyInput,
) {
  await assertNotExists(
    () =>
      db.dmpb.findUnique({
        where: { ma_pb: body.ma_pb },
        select: { ma_pb: true },
      }),
    new ConflictError(`Mã phòng ban "${body.ma_pb}" đã tồn tại`),
  );

  await db.dmpb.create({ data: body });
  return { ma_pb: body.ma_pb };
}

/** PUT cập nhật (không đổi khóa). */
export async function updatePhongBan(
  db: PrismaClient,
  maPb: string,
  body: PhongBanUpdateInput,
) {
  await findOrThrow(
    () =>
      db.dmpb.findUnique({ where: { ma_pb: maPb }, select: { ma_pb: true } }),
    new NotFoundError(MESSAGES.TONG_HOP.PHONG_BAN_NOT_FOUND),
  );

  await db.dmpb.update({
    where: { ma_pb: maPb },
    data: { ...body, datetime2: new Date() },
  });
  return { ma_pb: maPb };
}

/** DELETE. */
export async function deletePhongBan(db: PrismaClient, maPb: string) {
  await findOrThrow(
    () =>
      db.dmpb.findUnique({ where: { ma_pb: maPb }, select: { ma_pb: true } }),
    new NotFoundError(MESSAGES.TONG_HOP.PHONG_BAN_NOT_FOUND),
  );

  await db.dmpb.delete({ where: { ma_pb: maPb } });
  return { ma_pb: maPb };
}

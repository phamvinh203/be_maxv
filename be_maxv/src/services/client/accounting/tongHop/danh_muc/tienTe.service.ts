import type { Prisma, PrismaClient } from '../../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../../constants/messages';
import type {
  TienTeBodyInput,
  TienTeListQuery,
  TienTeUpdateInput,
} from '../../../../../validators/accounting/tongHop/tienTe.validator';

/** GET danh sách + lọc theo ma_nt / ten_nt. */
export function listTienTe(db: PrismaClient, q: TienTeListQuery) {
  const and: Prisma.dmntWhereInput[] = [];
  if (q.ma_nt) and.push({ ma_nt: { contains: q.ma_nt, mode: 'insensitive' } });
  if (q.ten_nt)
    and.push({ ten_nt: { contains: q.ten_nt, mode: 'insensitive' } });

  return db.dmnt.findMany({
    where: and.length ? { AND: and } : undefined,
    orderBy: { ma_nt: 'asc' },
  });
}

/** POST tạo mới. */
export async function createTienTe(db: PrismaClient, body: TienTeBodyInput) {
  await assertNotExists(
    () =>
      db.dmnt.findUnique({
        where: { ma_nt: body.ma_nt },
        select: { ma_nt: true },
      }),
    new ConflictError(`Mã ngoại tệ "${body.ma_nt}" đã tồn tại`),
  );

  await db.dmnt.create({ data: body });
  return { ma_nt: body.ma_nt };
}

/** PUT cập nhật (không đổi khóa). */
export async function updateTienTe(
  db: PrismaClient,
  maNt: string,
  body: TienTeUpdateInput,
) {
  await findOrThrow(
    () =>
      db.dmnt.findUnique({ where: { ma_nt: maNt }, select: { ma_nt: true } }),
    new NotFoundError(MESSAGES.TONG_HOP.TIEN_TE_NOT_FOUND),
  );

  await db.dmnt.update({
    where: { ma_nt: maNt },
    data: { ...body, datetime2: new Date() },
  });
  return { ma_nt: maNt };
}

/** DELETE. */
export async function deleteTienTe(db: PrismaClient, maNt: string) {
  await findOrThrow(
    () =>
      db.dmnt.findUnique({ where: { ma_nt: maNt }, select: { ma_nt: true } }),
    new NotFoundError(MESSAGES.TONG_HOP.TIEN_TE_NOT_FOUND),
  );

  await db.dmnt.delete({ where: { ma_nt: maNt } });
  return { ma_nt: maNt };
}

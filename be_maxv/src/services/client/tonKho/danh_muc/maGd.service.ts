import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../helpers/errors';
import { MESSAGES } from '../../../../constants/messages';
import type {
  MaGdBodyInput,
  MaGdListQuery,
  MaGdUpdateInput,
} from '../../../../validators/tonKho/maGd.validator';

const maGdSelect = {
  ma_ct: true,
  loai_ct: true,
  ma_gd: true,
  ten_gd: true,
  ten_gd2: true,
  status: true,
} satisfies Prisma.dmmagdSelect;

/** GET danh sách + lọc theo ma_ct / ma_gd / ten_gd. */
export function listMaGd(db: PrismaClient, q: MaGdListQuery) {
  const and: Prisma.dmmagdWhereInput[] = [];
  if (q.ma_ct) and.push({ ma_ct: { contains: q.ma_ct, mode: 'insensitive' } });
  if (q.ma_gd) and.push({ ma_gd: { contains: q.ma_gd, mode: 'insensitive' } });
  if (q.ten_gd)
    and.push({ ten_gd: { contains: q.ten_gd, mode: 'insensitive' } });

  return db.dmmagd.findMany({
    where: and.length ? { AND: and } : undefined,
    select: maGdSelect,
    orderBy: [{ ma_ct: 'asc' }, { ma_gd: 'asc' }],
  });
}

/** POST tạo mới. */
export async function createMaGd(db: PrismaClient, body: MaGdBodyInput) {
  const exists = await db.dmmagd.findUnique({
    where: { ma_ct_ma_gd: { ma_ct: body.ma_ct, ma_gd: body.ma_gd } },
    select: { ma_gd: true },
  });
  if (exists) {
    throw new ConflictError(
      `Mã giao dịch "${body.ma_gd}" của chứng từ "${body.ma_ct}" đã tồn tại`,
    );
  }

  await db.dmmagd.create({
    data: {
      ma_ct: body.ma_ct,
      loai_ct: body.loai_ct,
      ma_gd: body.ma_gd,
      ten_gd: body.ten_gd,
      ten_gd2: body.ten_gd2,
      status: body.status,
    },
  });
  return { ma_ct: body.ma_ct, ma_gd: body.ma_gd };
}

/** PUT cập nhật (không đổi khóa). */
export async function updateMaGd(
  db: PrismaClient,
  maCt: string,
  maGd: string,
  body: MaGdUpdateInput,
) {
  const current = await db.dmmagd.findUnique({
    where: { ma_ct_ma_gd: { ma_ct: maCt, ma_gd: maGd } },
    select: { ma_gd: true },
  });
  if (!current) throw new NotFoundError(MESSAGES.TON_KHO.MAGD_NOT_FOUND);

  await db.dmmagd.update({
    where: { ma_ct_ma_gd: { ma_ct: maCt, ma_gd: maGd } },
    data: {
      loai_ct: body.loai_ct,
      ten_gd: body.ten_gd,
      ten_gd2: body.ten_gd2,
      status: body.status,
      datetime2: new Date(),
    },
  });
  return { ma_ct: maCt, ma_gd: maGd };
}

/** DELETE. */
export async function deleteMaGd(db: PrismaClient, maCt: string, maGd: string) {
  const current = await db.dmmagd.findUnique({
    where: { ma_ct_ma_gd: { ma_ct: maCt, ma_gd: maGd } },
    select: { ma_gd: true },
  });
  if (!current) throw new NotFoundError(MESSAGES.TON_KHO.MAGD_NOT_FOUND);

  await db.dmmagd.delete({
    where: { ma_ct_ma_gd: { ma_ct: maCt, ma_gd: maGd } },
  });
  return { ma_ct: maCt, ma_gd: maGd };
}

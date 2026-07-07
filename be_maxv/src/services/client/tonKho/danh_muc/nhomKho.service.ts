import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../constants/messages';
import type {
  NhomKhoBodyInput,
  NhomKhoListQuery,
  NhomKhoUpdateInput,
} from '../../../../validators/tonKho/nhomKho.validator';

const nhSelect = {
  ma_nh: true,
  ten_nh: true,
  ten_nh2: true,
  status: true,
} satisfies Prisma.dmnhkhoSelect;

/** GET danh sách + lọc theo ma_nh / ten_nh. */
export function listNhomKho(db: PrismaClient, q: NhomKhoListQuery) {
  const and: Prisma.dmnhkhoWhereInput[] = [];
  if (q.ma_nh) and.push({ ma_nh: { contains: q.ma_nh, mode: 'insensitive' } });
  if (q.ten_nh)
    and.push({ ten_nh: { contains: q.ten_nh, mode: 'insensitive' } });

  return db.dmnhkho.findMany({
    where: and.length ? { AND: and } : undefined,
    select: nhSelect,
    orderBy: { ma_nh: 'asc' },
  });
}

/** POST tạo mới. */
export async function createNhomKho(db: PrismaClient, body: NhomKhoBodyInput) {
  await assertNotExists(
    () =>
      db.dmnhkho.findUnique({
        where: { ma_nh: body.ma_nh },
        select: { ma_nh: true },
      }),
    new ConflictError(`Mã nhóm "${body.ma_nh}" đã tồn tại`),
  );

  await db.dmnhkho.create({
    data: {
      ma_nh: body.ma_nh,
      ten_nh: body.ten_nh,
      ten_nh2: body.ten_nh2,
      status: body.status,
    },
  });
  return { ma_nh: body.ma_nh };
}

/** PUT cập nhật (không đổi khóa). */
export async function updateNhomKho(
  db: PrismaClient,
  maNh: string,
  body: NhomKhoUpdateInput,
) {
  await findOrThrow(
    () =>
      db.dmnhkho.findUnique({
        where: { ma_nh: maNh },
        select: { ma_nh: true },
      }),
    new NotFoundError(MESSAGES.TON_KHO.NHOM_KHO_NOT_FOUND),
  );

  await db.dmnhkho.update({
    where: { ma_nh: maNh },
    data: {
      ten_nh: body.ten_nh,
      ten_nh2: body.ten_nh2,
      status: body.status,
    },
  });
  return { ma_nh: maNh };
}

/** DELETE — chặn nếu nhóm kho đang được dùng trong kho (dmkho.ma_nh). */
export async function deleteNhomKho(db: PrismaClient, maNh: string) {
  await findOrThrow(
    () =>
      db.dmnhkho.findUnique({
        where: { ma_nh: maNh },
        select: { ma_nh: true },
      }),
    new NotFoundError(MESSAGES.TON_KHO.NHOM_KHO_NOT_FOUND),
  );

  const used = await db.dmkho.count({ where: { ma_nh: maNh } });
  if (used > 0) {
    throw new ConflictError('Nhóm kho đang được sử dụng, không thể xóa');
  }

  await db.dmnhkho.delete({ where: { ma_nh: maNh } });
  return { ma_nh: maNh };
}

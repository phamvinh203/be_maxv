import type { Prisma, PrismaClient } from '../../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../../constants/messages';
import type {
  LoaiVtBodyInput,
  LoaiVtListQuery,
  LoaiVtUpdateInput,
} from '../../../../../validators/accounting/tonKho/loaiVt.validator';

const loaiVtSelect = {
  ma_loai_vt: true,
  ten_loai_vt: true,
  ten_loai_vt2: true,
  status: true,
} satisfies Prisma.dmloaivtSelect;

/** GET danh sách + lọc theo ma_loai_vt / ten_loai_vt. */
export function listLoaiVt(db: PrismaClient, q: LoaiVtListQuery) {
  const and: Prisma.dmloaivtWhereInput[] = [];
  if (q.ma_loai_vt)
    and.push({ ma_loai_vt: { contains: q.ma_loai_vt, mode: 'insensitive' } });
  if (q.ten_loai_vt)
    and.push({ ten_loai_vt: { contains: q.ten_loai_vt, mode: 'insensitive' } });

  return db.dmloaivt.findMany({
    where: and.length ? { AND: and } : undefined,
    select: loaiVtSelect,
    orderBy: { ma_loai_vt: 'asc' },
  });
}

/** POST tạo mới. */
export async function createLoaiVt(db: PrismaClient, body: LoaiVtBodyInput) {
  await assertNotExists(
    () =>
      db.dmloaivt.findUnique({
        where: { ma_loai_vt: body.ma_loai_vt },
        select: { ma_loai_vt: true },
      }),
    new ConflictError(`Mã loại "${body.ma_loai_vt}" đã tồn tại`),
  );

  await db.dmloaivt.create({
    data: {
      ma_loai_vt: body.ma_loai_vt,
      ten_loai_vt: body.ten_loai_vt,
      ten_loai_vt2: body.ten_loai_vt2,
      status: body.status,
    },
  });
  return { ma_loai_vt: body.ma_loai_vt };
}

/** PUT cập nhật (không đổi khóa). */
export async function updateLoaiVt(
  db: PrismaClient,
  maLoai: string,
  body: LoaiVtUpdateInput,
) {
  await findOrThrow(
    () =>
      db.dmloaivt.findUnique({
        where: { ma_loai_vt: maLoai },
        select: { ma_loai_vt: true },
      }),
    new NotFoundError(MESSAGES.TON_KHO.LOAI_VT_NOT_FOUND),
  );

  await db.dmloaivt.update({
    where: { ma_loai_vt: maLoai },
    data: {
      ten_loai_vt: body.ten_loai_vt,
      ten_loai_vt2: body.ten_loai_vt2,
      status: body.status,
    },
  });
  return { ma_loai_vt: maLoai };
}

/** DELETE — chặn nếu loại đang được dùng trong hàng hóa (dmvt.loai_vt). */
export async function deleteLoaiVt(db: PrismaClient, maLoai: string) {
  await findOrThrow(
    () =>
      db.dmloaivt.findUnique({
        where: { ma_loai_vt: maLoai },
        select: { ma_loai_vt: true },
      }),
    new NotFoundError(MESSAGES.TON_KHO.LOAI_VT_NOT_FOUND),
  );

  const used = await db.dmvt.count({ where: { loai_vt: maLoai } });
  if (used > 0) {
    throw new ConflictError(
      `Loại "${maLoai}" đang được sử dụng trong hàng hóa, không thể xóa.`,
    );
  }

  await db.dmloaivt.delete({ where: { ma_loai_vt: maLoai } });
  return { ma_loai_vt: maLoai };
}

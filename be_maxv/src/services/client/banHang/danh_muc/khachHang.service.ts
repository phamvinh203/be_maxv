import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../constants/messages';
import type {
  KhachHangBodyInput,
  KhachHangListQuery,
  KhachHangUpdateInput,
} from '../../../../validators/banHang/khachHang.validator';

/** GET danh sách + lọc theo ma_kh / ten_kh / dia_chi / ma_so_thue. */
export function listKhachHang(db: PrismaClient, q: KhachHangListQuery) {
  const and: Prisma.dmkhWhereInput[] = [];
  if (q.ma_kh) and.push({ ma_kh: { contains: q.ma_kh, mode: 'insensitive' } });
  if (q.ten_kh)
    and.push({ ten_kh: { contains: q.ten_kh, mode: 'insensitive' } });
  if (q.dia_chi)
    and.push({ dia_chi: { contains: q.dia_chi, mode: 'insensitive' } });
  if (q.ma_so_thue)
    and.push({ ma_so_thue: { contains: q.ma_so_thue, mode: 'insensitive' } });

  return db.dmkh.findMany({
    where: and.length ? { AND: and } : undefined,
    orderBy: { ma_kh: 'asc' },
  });
}

/** POST tạo mới. */
export async function createKhachHang(
  db: PrismaClient,
  body: KhachHangBodyInput,
) {
  await assertNotExists(
    () =>
      db.dmkh.findUnique({
        where: { ma_kh: body.ma_kh },
        select: { ma_kh: true },
      }),
    new ConflictError(`Mã khách hàng "${body.ma_kh}" đã tồn tại`),
  );

  await db.dmkh.create({ data: body });
  return { ma_kh: body.ma_kh };
}

/** PUT cập nhật (không đổi khóa). */
export async function updateKhachHang(
  db: PrismaClient,
  maKh: string,
  body: KhachHangUpdateInput,
) {
  await findOrThrow(
    () =>
      db.dmkh.findUnique({ where: { ma_kh: maKh }, select: { ma_kh: true } }),
    new NotFoundError(MESSAGES.BAN_HANG.KHACH_HANG_NOT_FOUND),
  );

  await db.dmkh.update({
    where: { ma_kh: maKh },
    data: { ...body, datetime2: new Date() },
  });
  return { ma_kh: maKh };
}

/** DELETE. */
export async function deleteKhachHang(db: PrismaClient, maKh: string) {
  await findOrThrow(
    () =>
      db.dmkh.findUnique({ where: { ma_kh: maKh }, select: { ma_kh: true } }),
    new NotFoundError(MESSAGES.BAN_HANG.KHACH_HANG_NOT_FOUND),
  );

  await db.dmkh.delete({ where: { ma_kh: maKh } });
  return { ma_kh: maKh };
}

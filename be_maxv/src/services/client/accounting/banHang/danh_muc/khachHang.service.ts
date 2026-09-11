import type { Prisma, PrismaClient } from '../../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../../helpers/errors';
import {
  assertNotExists,
  findOrThrow,
  xoaNeuKhongConThamChieu,
} from '../../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../../constants/messages';
import type {
  KhachHangBodyInput,
  KhachHangListQuery,
  KhachHangUpdateInput,
} from '../../../../../validators/accounting/banHang/khachHang.validator';

/**
 * GET danh sách + lọc theo ma_kh / ten_kh / dia_chi / ma_so_thue, hoặc ô tìm chung `q` — PHÂN TRANG phía
 * server: `{ items, total, page, pageSize }` (vbsec 2026-09-10: trước đây trả toàn bộ bảng dmkh).
 */
export async function listKhachHang(db: PrismaClient, q: KhachHangListQuery) {
  const and: Prisma.dmkhWhereInput[] = [];
  if (q.q) {
    and.push({
      OR: [
        { ma_kh: { contains: q.q, mode: 'insensitive' } },
        { ten_kh: { contains: q.q, mode: 'insensitive' } },
        { ma_so_thue: { contains: q.q, mode: 'insensitive' } },
      ],
    });
  }
  if (q.ma_kh) and.push({ ma_kh: { contains: q.ma_kh, mode: 'insensitive' } });
  if (q.ten_kh)
    and.push({ ten_kh: { contains: q.ten_kh, mode: 'insensitive' } });
  if (q.dia_chi)
    and.push({ dia_chi: { contains: q.dia_chi, mode: 'insensitive' } });
  if (q.ma_so_thue)
    and.push({ ma_so_thue: { contains: q.ma_so_thue, mode: 'insensitive' } });

  const where = and.length ? { AND: and } : undefined;
  const [total, items] = await Promise.all([
    db.dmkh.count({ where }),
    db.dmkh.findMany({
      where,
      orderBy: { ma_kh: 'asc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
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
  const coHoaDon = new ConflictError(
    `Khách hàng "${maKh}" đã có hóa đơn bán hàng, không thể xóa.`,
  );

  // Trước đây không kiểm gì: xóa khách đang có hóa đơn để lại chứng từ mồ côi (mất tên khách).
  if ((await db.m81.count({ where: { ma_kh: maKh } })) > 0) throw coHoaDon;

  await xoaNeuKhongConThamChieu(
    () => db.dmkh.delete({ where: { ma_kh: maKh } }),
    coHoaDon,
  );
  return { ma_kh: maKh };
}

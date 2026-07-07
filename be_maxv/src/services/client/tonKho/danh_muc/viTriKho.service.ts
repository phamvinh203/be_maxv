import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../constants/messages';
import type {
  ViTriBodyInput,
  ViTriListQuery,
  ViTriUpdateInput,
} from '../../../../validators/tonKho/viTriKho.validator';

const viTriSelect = {
  ma_kho: true,
  ma_vi_tri: true,
  ten_vi_tri: true,
  ten_vi_tri2: true,
  status: true,
} satisfies Prisma.dmvitriSelect;

/** GET danh sách + lọc + kèm tên kho (join dmkho). */
export async function listViTri(db: PrismaClient, q: ViTriListQuery) {
  const and: Prisma.dmvitriWhereInput[] = [];
  if (q.ma_kho) and.push({ ma_kho: q.ma_kho });
  if (q.ma_vi_tri)
    and.push({ ma_vi_tri: { contains: q.ma_vi_tri, mode: 'insensitive' } });
  if (q.ten_vi_tri)
    and.push({ ten_vi_tri: { contains: q.ten_vi_tri, mode: 'insensitive' } });

  const [rows, khos] = await Promise.all([
    db.dmvitri.findMany({
      where: and.length ? { AND: and } : undefined,
      select: viTriSelect,
      orderBy: [{ ma_kho: 'asc' }, { ma_vi_tri: 'asc' }],
    }),
    db.dmkho.findMany({ select: { ma_kho: true, ten_kho: true } }),
  ]);

  const khoMap = new Map(khos.map((k) => [k.ma_kho, k.ten_kho]));
  return rows.map((r) => ({ ...r, ten_kho: khoMap.get(r.ma_kho) ?? null }));
}

/** POST tạo mới. */
export async function createViTri(db: PrismaClient, body: ViTriBodyInput) {
  await assertNotExists(
    () =>
      db.dmvitri.findUnique({
        where: {
          ma_kho_ma_vi_tri: { ma_kho: body.ma_kho, ma_vi_tri: body.ma_vi_tri },
        },
        select: { ma_vi_tri: true },
      }),
    new ConflictError(
      `Vị trí "${body.ma_vi_tri}" của kho "${body.ma_kho}" đã tồn tại`,
    ),
  );

  // Kho phải tồn tại (vị trí thuộc 1 kho).
  await findOrThrow(
    () =>
      db.dmkho.findUnique({
        where: { ma_kho: body.ma_kho },
        select: { ma_kho: true },
      }),
    new ConflictError(`Kho "${body.ma_kho}" không tồn tại`),
  );

  await db.dmvitri.create({
    data: {
      ma_kho: body.ma_kho,
      ma_vi_tri: body.ma_vi_tri,
      ten_vi_tri: body.ten_vi_tri,
      ten_vi_tri2: body.ten_vi_tri2,
      status: body.status,
    },
  });
  return { ma_kho: body.ma_kho, ma_vi_tri: body.ma_vi_tri };
}

/** PUT cập nhật (không đổi khóa). */
export async function updateViTri(
  db: PrismaClient,
  maKho: string,
  maViTri: string,
  body: ViTriUpdateInput,
) {
  await findOrThrow(
    () =>
      db.dmvitri.findUnique({
        where: { ma_kho_ma_vi_tri: { ma_kho: maKho, ma_vi_tri: maViTri } },
        select: { ma_vi_tri: true },
      }),
    new NotFoundError(MESSAGES.TON_KHO.VI_TRI_NOT_FOUND),
  );

  await db.dmvitri.update({
    where: { ma_kho_ma_vi_tri: { ma_kho: maKho, ma_vi_tri: maViTri } },
    data: {
      ten_vi_tri: body.ten_vi_tri,
      ten_vi_tri2: body.ten_vi_tri2,
      status: body.status,
    },
  });
  return { ma_kho: maKho, ma_vi_tri: maViTri };
}

/** DELETE — chặn nếu vị trí đang được dùng trong hàng hóa (dmvt). */
export async function deleteViTri(
  db: PrismaClient,
  maKho: string,
  maViTri: string,
) {
  await findOrThrow(
    () =>
      db.dmvitri.findUnique({
        where: { ma_kho_ma_vi_tri: { ma_kho: maKho, ma_vi_tri: maViTri } },
        select: { ma_vi_tri: true },
      }),
    new NotFoundError(MESSAGES.TON_KHO.VI_TRI_NOT_FOUND),
  );

  const used = await db.dmvt.count({
    where: { ma_kho: maKho, ma_vi_tri: maViTri },
  });
  if (used > 0) {
    throw new ConflictError(
      `Vị trí "${maViTri}" đang được sử dụng trong hàng hóa, không thể xóa.`,
    );
  }

  await db.dmvitri.delete({
    where: { ma_kho_ma_vi_tri: { ma_kho: maKho, ma_vi_tri: maViTri } },
  });
  return { ma_kho: maKho, ma_vi_tri: maViTri };
}

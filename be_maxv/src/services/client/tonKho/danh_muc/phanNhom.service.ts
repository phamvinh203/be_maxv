import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../constants/messages';
import type {
  PhanNhomBodyInput,
  PhanNhomListQuery,
} from '../../../../validators/tonKho/phanNhom.validator';

const nhSelect = {
  loai_nh: true,
  ma_nh: true,
  ten_nh: true,
  ten_nh2: true,
  status: true,
} satisfies Prisma.dmnhvtSelect;

/** Nhóm đang được dùng trong danh mục hàng hóa (nh_vt1/2/3 của dmvt). */
async function usedInHangHoa(db: PrismaClient, maNh: string): Promise<boolean> {
  const count = await db.dmvt.count({
    where: { OR: [{ nh_vt1: maNh }, { nh_vt2: maNh }, { nh_vt3: maNh }] },
  });
  return count > 0;
}

/** GET danh sách + lọc theo loai_nh / ma_nh / ten_nh. */
export function listPhanNhom(db: PrismaClient, q: PhanNhomListQuery) {
  const and: Prisma.dmnhvtWhereInput[] = [];
  if (q.loai_nh) and.push({ loai_nh: q.loai_nh });
  if (q.ma_nh) and.push({ ma_nh: { contains: q.ma_nh, mode: 'insensitive' } });
  if (q.ten_nh)
    and.push({ ten_nh: { contains: q.ten_nh, mode: 'insensitive' } });

  return db.dmnhvt.findMany({
    where: and.length ? { AND: and } : undefined,
    select: nhSelect,
    orderBy: [{ loai_nh: 'asc' }, { ma_nh: 'asc' }],
  });
}

/** POST tạo mới. */
export async function createPhanNhom(
  db: PrismaClient,
  body: PhanNhomBodyInput,
) {
  await assertNotExists(
    () =>
      db.dmnhvt.findUnique({
        where: { loai_nh_ma_nh: { loai_nh: body.loai_nh, ma_nh: body.ma_nh } },
        select: { ma_nh: true },
      }),
    new ConflictError(
      `Mã nhóm "${body.ma_nh}" (loại ${body.loai_nh}) đã tồn tại`,
    ),
  );

  await db.dmnhvt.create({
    data: {
      loai_nh: body.loai_nh,
      ma_nh: body.ma_nh,
      ten_nh: body.ten_nh,
      ten_nh2: body.ten_nh2,
      status: body.status,
    },
  });
  return { loai_nh: body.loai_nh, ma_nh: body.ma_nh };
}

/** PUT cập nhật; đổi khóa (loai_nh/ma_nh) -> xóa cũ + tạo mới (đổi PK ghép). */
export async function updatePhanNhom(
  db: PrismaClient,
  oldLoai: number,
  oldMa: string,
  body: PhanNhomBodyInput,
) {
  await findOrThrow(
    () =>
      db.dmnhvt.findUnique({
        where: { loai_nh_ma_nh: { loai_nh: oldLoai, ma_nh: oldMa } },
        select: { ma_nh: true },
      }),
    new NotFoundError(MESSAGES.TON_KHO.NHOM_NOT_FOUND),
  );

  const newLoai = body.loai_nh;
  const newMa = body.ma_nh;
  const keyChanged = newLoai !== oldLoai || newMa !== oldMa;

  if (keyChanged) {
    await assertNotExists(
      () =>
        db.dmnhvt.findUnique({
          where: { loai_nh_ma_nh: { loai_nh: newLoai, ma_nh: newMa } },
          select: { ma_nh: true },
        }),
      new ConflictError(`Mã nhóm "${newMa}" (loại ${newLoai}) đã tồn tại`),
    );
  }

  if (keyChanged) {
    await db.$transaction([
      db.dmnhvt.create({
        data: {
          loai_nh: newLoai,
          ma_nh: newMa,
          ten_nh: body.ten_nh,
          ten_nh2: body.ten_nh2,
          status: body.status,
        },
      }),
      db.dmnhvt.delete({
        where: { loai_nh_ma_nh: { loai_nh: oldLoai, ma_nh: oldMa } },
      }),
    ]);
  } else {
    await db.dmnhvt.update({
      where: { loai_nh_ma_nh: { loai_nh: oldLoai, ma_nh: oldMa } },
      data: {
        ten_nh: body.ten_nh,
        ten_nh2: body.ten_nh2,
        status: body.status,
      },
    });
  }
  return { loai_nh: newLoai, ma_nh: newMa };
}

/** DELETE — chặn nếu nhóm đang được dùng trong hàng hóa. */
export async function deletePhanNhom(
  db: PrismaClient,
  loaiNh: number,
  maNh: string,
) {
  await findOrThrow(
    () =>
      db.dmnhvt.findUnique({
        where: { loai_nh_ma_nh: { loai_nh: loaiNh, ma_nh: maNh } },
        select: { ma_nh: true },
      }),
    new NotFoundError(MESSAGES.TON_KHO.NHOM_NOT_FOUND),
  );

  if (await usedInHangHoa(db, maNh)) {
    throw new ConflictError(
      `Nhóm "${maNh}" đang được sử dụng trong danh mục hàng hóa, không thể xóa.`,
    );
  }

  await db.dmnhvt.delete({
    where: { loai_nh_ma_nh: { loai_nh: loaiNh, ma_nh: maNh } },
  });
  return { loai_nh: loaiNh, ma_nh: maNh };
}

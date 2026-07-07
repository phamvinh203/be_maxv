import type { Prisma, PrismaClient } from '../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../constants/messages';
import type {
  DvtBodyInput,
  DvtListQuery,
} from '../../../../validators/tonKho/dvt.validator';

const dvtSelect = {
  dvt: true,
  dvt2: true,
  ten_dvt: true,
  ten_dvt2: true,
  status: true,
} satisfies Prisma.dmdvtSelect;

/** Đvt đang được dùng trong danh mục hàng hóa (cột dvt hoặc dvt2 của dmvt). */
async function usedInHangHoa(db: PrismaClient, key: string): Promise<boolean> {
  const count = await db.dmvt.count({
    where: { OR: [{ dvt: key }, { dvt2: key }] },
  });
  return count > 0;
}

/** GET danh sách + lọc theo dvt / ten_dvt. */
export function listDvt(db: PrismaClient, q: DvtListQuery) {
  const and: Prisma.dmdvtWhereInput[] = [];
  if (q.dvt) and.push({ dvt: { contains: q.dvt, mode: 'insensitive' } });
  if (q.ten_dvt)
    and.push({ ten_dvt: { contains: q.ten_dvt, mode: 'insensitive' } });

  return db.dmdvt.findMany({
    where: and.length ? { AND: and } : undefined,
    select: dvtSelect,
    orderBy: { dvt: 'asc' },
  });
}

/** POST tạo mới. */
export async function createDvt(db: PrismaClient, body: DvtBodyInput) {
  await assertNotExists(
    () =>
      db.dmdvt.findUnique({ where: { dvt: body.dvt }, select: { dvt: true } }),
    new ConflictError(`Đvt "${body.dvt}" đã tồn tại`),
  );

  await db.dmdvt.create({
    data: {
      dvt: body.dvt,
      dvt2: body.dvt2,
      ten_dvt: body.ten_dvt,
      ten_dvt2: body.ten_dvt2,
      status: body.status,
    },
  });
  return { dvt: body.dvt };
}

/** PUT cập nhật (hỗ trợ đổi mã; chặn đổi mã nếu đvt đang được dùng). */
export async function updateDvt(
  db: PrismaClient,
  oldKey: string,
  body: DvtBodyInput,
) {
  await findOrThrow(
    () =>
      db.dmdvt.findUnique({ where: { dvt: oldKey }, select: { dvt: true } }),
    new NotFoundError(MESSAGES.TON_KHO.DVT_NOT_FOUND),
  );

  const newKey = body.dvt;
  if (newKey !== oldKey) {
    await assertNotExists(
      () =>
        db.dmdvt.findUnique({ where: { dvt: newKey }, select: { dvt: true } }),
      new ConflictError(`Đvt "${newKey}" đã tồn tại`),
    );

    if (await usedInHangHoa(db, oldKey)) {
      throw new ConflictError(
        `Đvt "${oldKey}" đang được sử dụng trong hàng hóa, không thể đổi mã.`,
      );
    }
  }

  await db.dmdvt.update({
    where: { dvt: oldKey },
    data: {
      dvt: newKey,
      dvt2: body.dvt2,
      ten_dvt: body.ten_dvt,
      ten_dvt2: body.ten_dvt2,
      status: body.status,
    },
  });
  return { dvt: newKey };
}

/** DELETE — chặn nếu đvt đang được dùng trong hàng hóa. */
export async function deleteDvt(db: PrismaClient, key: string) {
  await findOrThrow(
    () => db.dmdvt.findUnique({ where: { dvt: key }, select: { dvt: true } }),
    new NotFoundError(MESSAGES.TON_KHO.DVT_NOT_FOUND),
  );

  if (await usedInHangHoa(db, key)) {
    throw new ConflictError(
      `Đvt "${key}" đang được sử dụng trong danh mục hàng hóa, không thể xóa.`,
    );
  }

  await db.dmdvt.delete({ where: { dvt: key } });
  return { dvt: key };
}

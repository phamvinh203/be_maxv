import type { Prisma, PrismaClient } from '../../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../../constants/messages';
import type {
  KhoBodyInput,
  KhoListQuery,
} from '../../../../../validators/accounting/tonKho/kho.validator';

const khoSelect = {
  ma_kho: true,
  ma_dvcs: true,
  ten_kho: true,
  ten_kho2: true,
  dai_ly_yn: true,
  ma_nh: true,
  ghi_chu: true,
  status: true,
} satisfies Prisma.dmkhoSelect;

/** GET danh sách + lọc + kèm tên nhóm kho (thay LEFT JOIN dmnhkho). */
export async function listKho(db: PrismaClient, q: KhoListQuery) {
  const and: Prisma.dmkhoWhereInput[] = [];
  if (q.ma_kho)
    and.push({ ma_kho: { contains: q.ma_kho, mode: 'insensitive' } });
  if (q.ten_kho)
    and.push({ ten_kho: { contains: q.ten_kho, mode: 'insensitive' } });
  if (q.ma_dvcs) and.push({ ma_dvcs: q.ma_dvcs });

  const [rows, nhoms] = await Promise.all([
    db.dmkho.findMany({
      where: and.length ? { AND: and } : undefined,
      select: khoSelect,
      orderBy: { ma_kho: 'asc' },
    }),
    db.dmnhkho.findMany({ select: { ma_nh: true, ten_nh: true } }),
  ]);

  const nhMap = new Map(nhoms.map((n) => [n.ma_nh, n.ten_nh]));
  return rows.map((r) => ({
    ...r,
    ten_nhkho: r.ma_nh ? (nhMap.get(r.ma_nh) ?? null) : null,
  }));
}

/** POST tạo mới. */
export async function createKho(db: PrismaClient, body: KhoBodyInput) {
  await assertNotExists(
    () =>
      db.dmkho.findUnique({
        where: { ma_kho: body.ma_kho },
        select: { ma_kho: true },
      }),
    new ConflictError(`Mã kho "${body.ma_kho}" đã tồn tại`),
  );

  await db.dmkho.create({
    data: {
      ma_kho: body.ma_kho,
      ma_dvcs: body.ma_dvcs,
      ten_kho: body.ten_kho,
      ten_kho2: body.ten_kho2,
      dai_ly_yn: body.dai_ly_yn,
      ma_nh: body.ma_nh,
      ghi_chu: body.ghi_chu,
      status: body.status,
    },
  });
  return { ma_kho: body.ma_kho };
}

/** PUT cập nhật (đổi mã -> xóa cũ + tạo mới để đổi PK). */
export async function updateKho(
  db: PrismaClient,
  oldKey: string,
  body: KhoBodyInput,
) {
  await findOrThrow(
    () =>
      db.dmkho.findUnique({
        where: { ma_kho: oldKey },
        select: { ma_kho: true },
      }),
    new NotFoundError(MESSAGES.TON_KHO.KHO_NOT_FOUND),
  );

  const newKey = body.ma_kho;
  const data = {
    ma_dvcs: body.ma_dvcs,
    ten_kho: body.ten_kho,
    ten_kho2: body.ten_kho2,
    dai_ly_yn: body.dai_ly_yn,
    ma_nh: body.ma_nh,
    ghi_chu: body.ghi_chu,
    status: body.status,
  };

  if (newKey !== oldKey) {
    await assertNotExists(
      () =>
        db.dmkho.findUnique({
          where: { ma_kho: newKey },
          select: { ma_kho: true },
        }),
      new ConflictError(`Mã kho "${newKey}" đã tồn tại`),
    );

    await db.$transaction([
      db.dmkho.create({ data: { ma_kho: newKey, ...data } }),
      db.dmkho.delete({ where: { ma_kho: oldKey } }),
    ]);
  } else {
    await db.dmkho.update({ where: { ma_kho: oldKey }, data });
  }
  return { ma_kho: newKey };
}

/** DELETE — chặn nếu kho đang dùng trong hàng hóa hoặc còn vị trí kho. */
export async function deleteKho(db: PrismaClient, key: string) {
  await findOrThrow(
    () =>
      db.dmkho.findUnique({ where: { ma_kho: key }, select: { ma_kho: true } }),
    new NotFoundError(MESSAGES.TON_KHO.KHO_NOT_FOUND),
  );

  const [usedVt, usedVitri] = await Promise.all([
    db.dmvt.count({ where: { ma_kho: key } }),
    db.dmvitri.count({ where: { ma_kho: key } }),
  ]);
  if (usedVt > 0) {
    throw new ConflictError(
      `Kho "${key}" đang được sử dụng trong hàng hóa, không thể xóa.`,
    );
  }
  if (usedVitri > 0) {
    throw new ConflictError(
      `Kho "${key}" đang có vị trí kho, vui lòng xóa vị trí trước.`,
    );
  }

  await db.dmkho.delete({ where: { ma_kho: key } });
  return { ma_kho: key };
}

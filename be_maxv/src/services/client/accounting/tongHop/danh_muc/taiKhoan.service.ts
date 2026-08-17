import type { Prisma, PrismaClient } from '../../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../../constants/messages';
import type {
  TaiKhoanBodyInput,
  TaiKhoanListQuery,
  TaiKhoanUpdateInput,
} from '../../../../../validators/accounting/tongHop/taiKhoan.validator';

/** GET danh sách + lọc theo tk / ten_tk / tk_me / ma_nt. */
export function listTaiKhoan(db: PrismaClient, q: TaiKhoanListQuery) {
  const and: Prisma.dmtkWhereInput[] = [];
  if (q.tk) and.push({ tk: { contains: q.tk, mode: 'insensitive' } });
  if (q.ten_tk)
    and.push({ ten_tk: { contains: q.ten_tk, mode: 'insensitive' } });
  if (q.tk_me) and.push({ tk_me: { contains: q.tk_me, mode: 'insensitive' } });
  if (q.ma_nt) and.push({ ma_nt: { contains: q.ma_nt, mode: 'insensitive' } });

  return db.dmtk.findMany({
    where: and.length ? { AND: and } : undefined,
    orderBy: { tk: 'asc' },
  });
}

/** POST tạo mới. */
export async function createTaiKhoan(
  db: PrismaClient,
  body: TaiKhoanBodyInput,
) {
  await assertNotExists(
    () => db.dmtk.findUnique({ where: { tk: body.tk }, select: { tk: true } }),
    new ConflictError(`Tài khoản "${body.tk}" đã tồn tại`),
  );

  await db.dmtk.create({ data: body });
  return { tk: body.tk };
}

/** PUT cập nhật (không đổi khóa). */
export async function updateTaiKhoan(
  db: PrismaClient,
  tk: string,
  body: TaiKhoanUpdateInput,
) {
  await findOrThrow(
    () => db.dmtk.findUnique({ where: { tk }, select: { tk: true } }),
    new NotFoundError(MESSAGES.TONG_HOP.TAI_KHOAN_NOT_FOUND),
  );

  await db.dmtk.update({ where: { tk }, data: body });
  return { tk };
}

/** DELETE — chặn nếu tài khoản có tài khoản con (tk_me = tk). */
export async function deleteTaiKhoan(db: PrismaClient, tk: string) {
  await findOrThrow(
    () => db.dmtk.findUnique({ where: { tk }, select: { tk: true } }),
    new NotFoundError(MESSAGES.TONG_HOP.TAI_KHOAN_NOT_FOUND),
  );

  const children = await db.dmtk.count({ where: { tk_me: tk } });
  if (children > 0) {
    throw new ConflictError(
      `Tài khoản "${tk}" đang có tài khoản con, vui lòng xóa tài khoản con trước.`,
    );
  }

  await db.dmtk.delete({ where: { tk } });
  return { tk };
}

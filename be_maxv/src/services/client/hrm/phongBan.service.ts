import type { Prisma, PrismaClient } from '../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../helpers/crudGuards';
import { MESSAGES } from '../../../constants/messages';
import type {
  PhongBanBodyInput,
  PhongBanListQuery,
  PhongBanUpdateInput,
} from '../../../validators/hrm/phongBan.validator';

const phongBanSelect = {
  ma_pb: true,
  ten_pb: true,
  ma_pb_me: true,
  ghi_chu: true,
  status: true,
} satisfies Prisma.hrm_phong_banSelect;

/**
 * Kiểm tra phòng ban cha hợp lệ: có tồn tại, và không phải chính nó.
 * Dùng chung cho create/update; riêng chống vòng lặp chỉ update mới cần (xem `assertKhongVongLap`).
 */
async function assertPhongBanMeHopLe(
  db: PrismaClient,
  maPb: string,
  maPbMe: string,
): Promise<void> {
  if (maPbMe === maPb) {
    throw new ConflictError(MESSAGES.HRM.PHONG_BAN_ME_SELF);
  }
  await findOrThrow(
    () =>
      db.hrm_phong_ban.findUnique({
        where: { ma_pb: maPbMe },
        select: { ma_pb: true },
      }),
    new NotFoundError(MESSAGES.HRM.PHONG_BAN_ME_NOT_FOUND),
  );
}

/**
 * Chặn vòng lặp trong cây phòng ban: đi ngược chuỗi cha từ `maPbMe` lên gốc, gặp lại `maPb`
 * nghĩa là đang chọn chính cấp dưới của mình làm cha (A -> B -> A) — cây mất gốc, mọi truy vấn
 * đệ quy sau này treo. `daDuyet` vừa để phát hiện chạm lại `maPb`, vừa làm chốt an toàn nếu dữ
 * liệu cũ lỡ đã có vòng (không thì vòng while chạy vô tận).
 */
async function assertKhongVongLap(
  db: PrismaClient,
  maPb: string,
  maPbMe: string,
): Promise<void> {
  const daDuyet = new Set<string>([maPb]);
  let hienTai: string | null = maPbMe;

  while (hienTai) {
    if (daDuyet.has(hienTai)) {
      throw new ConflictError(MESSAGES.HRM.PHONG_BAN_ME_VONG_LAP);
    }
    daDuyet.add(hienTai);

    const cha: { ma_pb_me: string | null } | null =
      await db.hrm_phong_ban.findUnique({
        where: { ma_pb: hienTai },
        select: { ma_pb_me: true },
      });
    hienTai = cha?.ma_pb_me ?? null;
  }
}

/**
 * GET danh sách + lọc, kèm `ten_pb_me` (tên phòng ban cha) để FE khỏi tự nối.
 * Danh mục phòng ban vốn nhỏ nên lấy hết 1 lượt rồi map trong bộ nhớ — không thêm query.
 */
export async function listPhongBan(db: PrismaClient, q: PhongBanListQuery) {
  const and: Prisma.hrm_phong_banWhereInput[] = [];
  if (q.ma_pb) and.push({ ma_pb: { contains: q.ma_pb, mode: 'insensitive' } });
  if (q.ten_pb)
    and.push({ ten_pb: { contains: q.ten_pb, mode: 'insensitive' } });
  if (q.status) and.push({ status: q.status });

  const [rows, tatCa] = await Promise.all([
    db.hrm_phong_ban.findMany({
      where: and.length ? { AND: and } : undefined,
      select: phongBanSelect,
      orderBy: { ma_pb: 'asc' },
    }),
    // Lấy riêng danh sách tên: phòng ban cha có thể bị lọc khỏi `rows` (vd lọc theo tên con)
    // nhưng vẫn phải hiện đúng tên cha.
    db.hrm_phong_ban.findMany({ select: { ma_pb: true, ten_pb: true } }),
  ]);

  const tenTheoMa = new Map(tatCa.map((r) => [r.ma_pb, r.ten_pb]));
  return rows.map((r) => ({
    ...r,
    ten_pb_me: r.ma_pb_me ? (tenTheoMa.get(r.ma_pb_me) ?? null) : null,
  }));
}

/** POST tạo mới. */
export async function createPhongBan(
  db: PrismaClient,
  body: PhongBanBodyInput,
) {
  await assertNotExists(
    () =>
      db.hrm_phong_ban.findUnique({
        where: { ma_pb: body.ma_pb },
        select: { ma_pb: true },
      }),
    new ConflictError(`Mã phòng ban "${body.ma_pb}" đã tồn tại`),
  );

  // Bản ghi mới chưa thể là cha của ai nên không cần kiểm tra vòng lặp.
  if (body.ma_pb_me) {
    await assertPhongBanMeHopLe(db, body.ma_pb, body.ma_pb_me);
  }

  await db.hrm_phong_ban.create({ data: body });
  return { ma_pb: body.ma_pb };
}

/** PUT cập nhật (không đổi khóa — xem ghi chú ở phongBanUpdateSchema). */
export async function updatePhongBan(
  db: PrismaClient,
  maPb: string,
  body: PhongBanUpdateInput,
) {
  await findOrThrow(
    () =>
      db.hrm_phong_ban.findUnique({
        where: { ma_pb: maPb },
        select: { ma_pb: true },
      }),
    new NotFoundError(MESSAGES.HRM.PHONG_BAN_NOT_FOUND),
  );

  if (body.ma_pb_me) {
    await assertPhongBanMeHopLe(db, maPb, body.ma_pb_me);
    await assertKhongVongLap(db, maPb, body.ma_pb_me);
  }

  await db.hrm_phong_ban.update({
    where: { ma_pb: maPb },
    data: { ...body, datetime2: new Date() },
  });
  return { ma_pb: maPb };
}

/** DELETE — chặn nếu còn phòng ban trực thuộc hoặc còn nhân viên đang thuộc phòng ban này. */
export async function deletePhongBan(db: PrismaClient, maPb: string) {
  await findOrThrow(
    () =>
      db.hrm_phong_ban.findUnique({
        where: { ma_pb: maPb },
        select: { ma_pb: true },
      }),
    new NotFoundError(MESSAGES.HRM.PHONG_BAN_NOT_FOUND),
  );

  // Hai tham chiếu này là FK MỀM (không ràng buộc ở DB, xem schema.prisma) nên phải tự chặn:
  // xóa thẳng sẽ để lại nhân viên/phòng ban con trỏ vào mã không còn tồn tại.
  const [soPhongBanCon, soNhanVien] = await Promise.all([
    db.hrm_phong_ban.count({ where: { ma_pb_me: maPb } }),
    db.hrm_nhan_vien.count({ where: { ma_pb: maPb } }),
  ]);
  if (soPhongBanCon > 0) {
    throw new ConflictError(
      `Phòng ban "${maPb}" đang có ${soPhongBanCon} phòng ban trực thuộc, vui lòng xử lý các phòng ban đó trước.`,
    );
  }
  if (soNhanVien > 0) {
    throw new ConflictError(
      `Phòng ban "${maPb}" đang có ${soNhanVien} nhân viên, không thể xóa.`,
    );
  }

  await db.hrm_phong_ban.delete({ where: { ma_pb: maPb } });
  return { ma_pb: maPb };
}

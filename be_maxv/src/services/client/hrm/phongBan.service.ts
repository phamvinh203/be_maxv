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

/** Khớp `@db.VarChar(24)` của cột ma_pb — vượt là Postgres từ chối cả dòng. */
const MA_PB_MAX = 24;

function kiemTraDoDaiMa(ma: string): string {
  if (ma.length > MA_PB_MAX) {
    throw new ConflictError(
      `Cây phòng ban quá sâu để tự sinh mã ("${ma}" vượt ${MA_PB_MAX} ký tự). Vui lòng tự nhập mã ngắn hơn.`,
    );
  }
  return ma;
}

/**
 * Sinh mã kế tiếp theo cây: gốc là `PB01`, `PB02`…; con của `PB01` là `PB01.01`.
 *
 * Thuật toán chuyển nguyên từ FE (`hdđt_maxv/src/features/hrm/cay.ts`) về đây để mã do MỘT
 * chỗ cấp — FE tự sinh thì hai người tạo cùng lúc trên hai máy dễ ra trùng mã.
 * Mã chỉ phản ánh vị trí LÚC TẠO: đổi "trực thuộc" sau này không đổi mã, vì mã đã nằm trên
 * chứng từ kế toán bên fe_maxv.
 *
 * CỐ Ý quét CẢ phòng ban đã xóa mềm (`da_xoa = true`): mã của đơn vị đã xóa không được cấp
 * lại cho đơn vị khác, nếu không thì chứng từ cũ bị gán sang đơn vị mới mà không ai hay.
 */
async function sinhMaPhongBan(
  db: PrismaClient,
  maPbMe: string | null,
): Promise<string> {
  const tienTo = maPbMe ? `${maPbMe}.` : 'PB';
  const rows = await db.hrm_phong_ban.findMany({
    where: { ma_pb: { startsWith: tienTo } },
    select: { ma_pb: true },
  });
  const daDung = new Set(rows.map((r) => r.ma_pb));

  for (let i = 1; i <= 99; i += 1) {
    const ma = `${tienTo}${String(i).padStart(2, '0')}`;
    if (!daDung.has(ma)) return kiemTraDoDaiMa(ma);
  }
  // Hết 99 số ở cùng cấp — hiếm, nhưng không được đứng im: lấy đuôi timestamp làm mã.
  return kiemTraDoDaiMa(`${tienTo}${Date.now().toString().slice(-4)}`);
}

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
      db.hrm_phong_ban.findFirst({
        where: { ma_pb: maPbMe, da_xoa: false },
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
  const and: Prisma.hrm_phong_banWhereInput[] = [{ da_xoa: false }];
  if (q.ma_pb) and.push({ ma_pb: { contains: q.ma_pb, mode: 'insensitive' } });
  if (q.ten_pb)
    and.push({ ten_pb: { contains: q.ten_pb, mode: 'insensitive' } });
  if (q.status) and.push({ status: q.status });

  const [rows, tatCa, demNhanVien] = await Promise.all([
    db.hrm_phong_ban.findMany({
      where: { AND: and },
      select: phongBanSelect,
      orderBy: { ma_pb: 'asc' },
    }),
    // Lấy riêng danh sách tên: phòng ban cha có thể bị lọc khỏi `rows` (vd lọc theo tên con)
    // nhưng vẫn phải hiện đúng tên cha.
    db.hrm_phong_ban.findMany({
      where: { da_xoa: false },
      select: { ma_pb: true, ten_pb: true },
    }),
    // `so_nv` chỉ đếm người ĐANG LÀM (status '1'): cột này trả lời "phòng ban có bao nhiêu
    // người làm việc", gộp cả người đã nghỉ vào là con số không dùng được để làm gì.
    // Guard lúc xóa thì đếm khác — xem `deletePhongBan`.
    db.hrm_nhan_vien.groupBy({
      by: ['ma_pb'],
      where: { da_xoa: false, status: '1' },
      _count: { _all: true },
    }),
  ]);

  const tenTheoMa = new Map(tatCa.map((r) => [r.ma_pb, r.ten_pb]));
  const soNvTheoMa = new Map(
    demNhanVien
      .filter((g): g is typeof g & { ma_pb: string } => g.ma_pb !== null)
      .map((g) => [g.ma_pb, g._count._all]),
  );

  return rows.map((r) => ({
    ...r,
    ten_pb_me: r.ma_pb_me ? (tenTheoMa.get(r.ma_pb_me) ?? null) : null,
    so_nv: soNvTheoMa.get(r.ma_pb) ?? 0,
  }));
}

/** POST tạo mới. */
export async function createPhongBan(
  db: PrismaClient,
  body: PhongBanBodyInput,
) {
  // Kiểm tra phòng ban cha TRƯỚC khi sinh mã: mã con lấy cha làm tiền tố, cha sai thì mã sinh
  // ra cũng sai. Bản ghi mới chưa thể là cha của ai nên không cần kiểm tra vòng lặp.
  if (body.ma_pb_me) {
    await assertPhongBanMeHopLe(db, body.ma_pb ?? '', body.ma_pb_me);
  }

  const maPb = body.ma_pb ?? (await sinhMaPhongBan(db, body.ma_pb_me));

  await assertNotExists(
    () =>
      db.hrm_phong_ban.findUnique({
        where: { ma_pb: maPb },
        select: { ma_pb: true },
      }),
    new ConflictError(`Mã phòng ban "${maPb}" đã tồn tại`),
  );

  await db.hrm_phong_ban.create({
    data: {
      ma_pb: maPb,
      ten_pb: body.ten_pb,
      ma_pb_me: body.ma_pb_me,
      ghi_chu: body.ghi_chu,
      status: body.status,
    },
  });
  return { ma_pb: maPb };
}

/** PUT cập nhật (không đổi khóa — xem ghi chú ở phongBanUpdateSchema). */
export async function updatePhongBan(
  db: PrismaClient,
  maPb: string,
  body: PhongBanUpdateInput,
) {
  await findOrThrow(
    () =>
      db.hrm_phong_ban.findFirst({
        where: { ma_pb: maPb, da_xoa: false },
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

/**
 * DELETE — XÓA MỀM (đặt `da_xoa = true`), không xóa dòng.
 * Giữ dòng lại để `ma_pb` không bao giờ được cấp lại; xem ghi chú ở `sinhMaPhongBan`.
 * Vẫn chặn nếu còn phòng ban trực thuộc hoặc còn nhân viên (chỉ đếm bản ghi CHƯA xóa).
 */
export async function deletePhongBan(db: PrismaClient, maPb: string) {
  await findOrThrow(
    () =>
      db.hrm_phong_ban.findFirst({
        where: { ma_pb: maPb, da_xoa: false },
        select: { ma_pb: true },
      }),
    new NotFoundError(MESSAGES.HRM.PHONG_BAN_NOT_FOUND),
  );

  // Hai tham chiếu này là FK MỀM (không ràng buộc ở DB, xem schema.prisma) nên phải tự chặn:
  // xóa thẳng sẽ để lại nhân viên/phòng ban con trỏ vào mã không còn tồn tại.
  // Guard đếm CẢ người đã nghỉ (khác `so_nv` ở danh sách): hồ sơ người đã nghỉ vẫn trỏ vào
  // phòng ban này và còn phải dùng khi quyết toán thuế — xóa đi là bỏ lại tham chiếu chết.
  const [soPhongBanCon, soNhanVien, soDangLam] = await Promise.all([
    db.hrm_phong_ban.count({ where: { ma_pb_me: maPb, da_xoa: false } }),
    db.hrm_nhan_vien.count({ where: { ma_pb: maPb, da_xoa: false } }),
    db.hrm_nhan_vien.count({
      where: { ma_pb: maPb, da_xoa: false, status: '1' },
    }),
  ]);
  if (soPhongBanCon > 0) {
    throw new ConflictError(
      `Phòng ban "${maPb}" đang có ${soPhongBanCon} phòng ban trực thuộc, vui lòng xử lý các phòng ban đó trước.`,
    );
  }
  if (soNhanVien > 0) {
    // Nói rõ cả hai con số: nếu chỉ báo tổng thì người dùng thấy cột "Nhân viên" hiện 0
    // (chỉ đếm người đang làm) mà vẫn bị chặn, không hiểu vì sao.
    const daNghi = soNhanVien - soDangLam;
    const chiTiet =
      daNghi > 0
        ? `${soNhanVien} nhân viên (${soDangLam} đang làm, ${daNghi} đã nghỉ)`
        : `${soNhanVien} nhân viên`;
    throw new ConflictError(
      `Phòng ban "${maPb}" đang có ${chiTiet}, không thể xóa.`,
    );
  }

  await db.hrm_phong_ban.update({
    where: { ma_pb: maPb },
    data: { da_xoa: true, datetime2: new Date() },
  });
  return { ma_pb: maPb };
}

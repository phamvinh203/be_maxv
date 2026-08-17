import type { Prisma, PrismaClient } from '../../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../../helpers/errors';
import { assertNotExists, findOrThrow } from '../../../../../helpers/crudGuards';
import { MESSAGES } from '../../../../../constants/messages';
import type {
  DoiMaInput,
  HangHoaBodyInput,
  HangHoaListQuery,
} from '../../../../../validators/accounting/tonKho/hangHoa.validator';

/**
 * Bảng có tồn tại trong DB tenant không (một số bảng tham chiếu như ct70/cdlo
 * chỉ xuất hiện sau khi phát sinh nghiệp vụ). Dùng để TRÁNH chạy raw SQL vào
 * bảng thiếu — vì lỗi SQL bên trong 1 interactive transaction sẽ khiến Postgres
 * abort toàn bộ transaction (rollback cả các lệnh trước đó), kể cả khi ta catch.
 */
async function tableExists(db: PrismaClient, name: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<Array<{ reg: string | null }>>(
    `SELECT to_regclass('public.${name}')::text AS reg`,
  );
  return rows[0]?.reg != null;
}

/** Cột hiển thị ở lưới danh sách (khớp maxv_v1). */
const listSelect = {
  ma_vt: true,
  ten_vt: true,
  ten_vt2: true,
  dvt: true,
  dvt2: true,
  he_so2: true,
  nhieu_dvt: true,
  loai_vt: true,
  gia_ton: true,
  vt_ton_kho: true,
  lo_yn: true,
  kk_yn: true,
  tk_vt: true,
  tk_dt: true,
  tk_dtnb: true,
  tk_gv: true,
  tk_tl: true,
  tk_cpbh: true,
  tk_spdd: true,
  tk_cl_vt: true,
  nh_vt1: true,
  nh_vt2: true,
  nh_vt3: true,
  ma_kho: true,
  ma_vi_tri: true,
  ma_thue: true,
  ma_thue_nk: true,
  status: true,
  ghi_chu: true,
} satisfies Prisma.dmvtSelect;

/** Ánh xạ body -> data ghi vào dmvt (không gồm ma_vt & audit). */
function toDmvtData(b: HangHoaBodyInput) {
  return {
    ten_vt: b.ten_vt,
    ten_vt2: b.ten_vt2,
    dvt: b.dvt,
    dvt2: b.dvt2,
    he_so2: b.he_so2,
    nhieu_dvt: b.nhieu_dvt,
    vt_ton_kho: b.vt_ton_kho,
    lo_yn: b.lo_yn,
    kk_yn: b.kk_yn,
    gia_ton: b.gia_ton,
    loai_vt: b.loai_vt,
    nh_vt1: b.nh_vt1,
    nh_vt2: b.nh_vt2,
    nh_vt3: b.nh_vt3,
    ma_kho: b.ma_kho,
    ma_vi_tri: b.ma_vi_tri,
    ma_thue: b.ma_thue,
    ma_thue_nk: b.ma_thue_nk,
    tk_vt: b.tk_vt,
    sua_tk_vt: b.sua_tk_vt,
    tk_gv: b.tk_gv,
    tk_dt: b.tk_dt,
    tk_dtnb: b.tk_dtnb,
    tk_tl: b.tk_tl,
    tk_dl: b.tk_dl,
    tk_spdd: b.tk_spdd,
    tk_cl_vt: b.tk_cl_vt,
    tk_ck: b.tk_ck,
    tk_cpbh: b.tk_cpbh,
    kieu_lo: b.kieu_lo,
    cach_xuat: b.cach_xuat,
    so_ngay_sp: b.so_ngay_sp,
    so_ngay_bh: b.so_ngay_bh,
    tao_lo: b.tao_lo,
    sl_min: b.sl_min,
    sl_max: b.sl_max,
    volume: b.volume,
    dvtvolume: b.dvtvolume,
    weight: b.weight,
    dvtweight: b.dvtweight,
    ghi_chu: b.ghi_chu,
    status: b.status,
  };
}

/** GET danh sách + search + filter status + phân trang. */
export async function listHangHoa(db: PrismaClient, q: HangHoaListQuery) {
  const where: Prisma.dmvtWhereInput = {};
  if (q.search) {
    where.OR = [
      { ma_vt: { contains: q.search, mode: 'insensitive' } },
      { ten_vt: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  if (q.status) where.status = q.status;

  const [rows, total] = await Promise.all([
    db.dmvt.findMany({
      where,
      select: listSelect,
      orderBy: { ma_vt: 'asc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    db.dmvt.count({ where }),
  ]);

  return { data: rows, total, page: q.page, limit: q.limit };
}

/** GET chi tiết 1 mặt hàng. */
export async function getHangHoa(db: PrismaClient, maVt: string) {
  return findOrThrow(
    () => db.dmvt.findUnique({ where: { ma_vt: maVt } }),
    new NotFoundError(MESSAGES.TON_KHO.VT_NOT_FOUND),
  );
}

/** POST tạo mới (+ đồng bộ dmqddvt nếu nhiều ĐVT). */
export async function createHangHoa(
  db: PrismaClient,
  body: HangHoaBodyInput,
  userId: string,
) {
  await assertNotExists(
    () =>
      db.dmvt.findUnique({
        where: { ma_vt: body.ma_vt },
        select: { ma_vt: true },
      }),
    new ConflictError(`Mã hàng "${body.ma_vt}" đã tồn tại trong danh mục.`),
  );

  await db.$transaction(async (tx) => {
    await tx.dmvt.create({
      data: {
        ma_vt: body.ma_vt,
        ...toDmvtData(body),
        user_id0: userId,
        user_id2: userId,
      },
    });

    if (body.nhieu_dvt && body.dvt) {
      await tx.dmqddvt.upsert({
        where: { ma_vt_dvt: { ma_vt: body.ma_vt, dvt: body.dvt } },
        create: {
          ma_vt: body.ma_vt,
          dvt: body.dvt,
          he_so: 1,
          xtype: 'S',
          status: '1',
          user_id0: userId,
          user_id2: userId,
        },
        update: {},
      });
    }
  });

  return { ma_vt: body.ma_vt };
}

/** PUT cập nhật (hỗ trợ đổi mã) + đồng bộ dmqddvt. */
export async function updateHangHoa(
  db: PrismaClient,
  oldKey: string,
  body: HangHoaBodyInput,
  userId: string,
) {
  const current = await findOrThrow(
    () =>
      db.dmvt.findUnique({
        where: { ma_vt: oldKey },
        select: { dvt: true, nhieu_dvt: true },
      }),
    new NotFoundError(MESSAGES.TON_KHO.VT_NOT_FOUND),
  );

  const newKey = body.ma_vt;
  if (newKey !== oldKey) {
    await assertNotExists(
      () =>
        db.dmvt.findUnique({
          where: { ma_vt: newKey },
          select: { ma_vt: true },
        }),
      new ConflictError(`Mã hàng "${newKey}" đã tồn tại.`),
    );
  }

  await db.$transaction(async (tx) => {
    await tx.dmvt.update({
      where: { ma_vt: oldKey },
      data: {
        ma_vt: newKey, // onUpdate: Cascade -> dmqddvt.ma_vt tự đổi theo
        ...toDmvtData(body),
        user_id2: userId,
      },
    });

    // Đồng bộ dmqddvt khi đổi ĐVT hoặc bật/tắt nhiều ĐVT.
    if (body.dvt !== current.dvt || body.nhieu_dvt !== current.nhieu_dvt) {
      await tx.dmqddvt.deleteMany({ where: { ma_vt: newKey, xtype: 'S' } });
      if (body.nhieu_dvt && body.dvt) {
        await tx.dmqddvt.upsert({
          where: { ma_vt_dvt: { ma_vt: newKey, dvt: body.dvt } },
          create: {
            ma_vt: newKey,
            dvt: body.dvt,
            he_so: 1,
            xtype: 'S',
            status: '1',
            user_id0: userId,
            user_id2: userId,
          },
          update: {},
        });
      }
    }
  });

  return { ma_vt: newKey };
}

/** DELETE — chặn nếu đã phát sinh chứng từ (ct70). */
export async function deleteHangHoa(db: PrismaClient, maVt: string) {
  await findOrThrow(
    () =>
      db.dmvt.findUnique({ where: { ma_vt: maVt }, select: { ma_vt: true } }),
    new NotFoundError(MESSAGES.TON_KHO.VT_NOT_FOUND),
  );

  // ct70 (chi tiết nhập/xuất kho) có thể chưa tồn tại -> chỉ kiểm tra khi có bảng.
  if (await tableExists(db, 'ct70')) {
    const used = await db.$queryRawUnsafe<Array<{ ok: number }>>(
      `SELECT 1 AS ok FROM ct70 WHERE ma_vt = $1 LIMIT 1`,
      maVt,
    );
    if (used.length > 0) {
      throw new ConflictError(
        `Mã hàng "${maVt}" đã phát sinh chứng từ, không thể xóa.`,
      );
    }
  }

  // onDelete: Cascade -> dmqddvt tự xóa theo.
  await db.dmvt.delete({ where: { ma_vt: maVt } });
  return { ma_vt: maVt };
}

/** PUT đổi / gộp mã hàng (tương đương pr_Changecode 'dmvt'). */
export async function doiMaHangHoa(db: PrismaClient, input: DoiMaInput) {
  const oldKey = input.ma_cu.trim().toUpperCase();
  const newKey = input.ma_moi.trim().toUpperCase();

  if (oldKey === newKey) throw new ConflictError(MESSAGES.TON_KHO.DOI_MA_SAME);

  await findOrThrow(
    () =>
      db.dmvt.findUnique({ where: { ma_vt: oldKey }, select: { ma_vt: true } }),
    new NotFoundError(`Mã hàng "${oldKey}" không tồn tại`),
  );

  await assertNotExists(
    () =>
      db.dmvt.findUnique({ where: { ma_vt: newKey }, select: { ma_vt: true } }),
    new ConflictError(`Mã hàng "${newKey}" đã tồn tại`),
  );

  // Kiểm tra bảng tham chiếu TRƯỚC transaction (tránh SQL lỗi làm abort tx).
  const hasCdlo = await tableExists(db, 'cdlo');
  const hasCdlo2 = await tableExists(db, 'cdlo2');

  await db.$transaction(async (tx) => {
    // Đổi mã trong dmvt (onUpdate: Cascade -> dmqddvt tự theo).
    await tx.dmvt.update({
      where: { ma_vt: oldKey },
      data: { ma_vt: newKey, datetime2: new Date() },
    });

    // Cập nhật các bảng tồn kho đầu kỳ nếu đã có (cdlo, cdlo2).
    if (hasCdlo) {
      await tx.$executeRawUnsafe(
        `UPDATE cdlo SET ma_vt = $1 WHERE ma_vt = $2`,
        newKey,
        oldKey,
      );
    }
    if (hasCdlo2) {
      await tx.$executeRawUnsafe(
        `UPDATE cdlo2 SET ma_vt = $1 WHERE ma_vt = $2`,
        newKey,
        oldKey,
      );
    }
  });

  return { ma_moi: newKey };
}

import type { Prisma, PrismaClient } from '../../../../../generated/tenant';
import { ConflictError, NotFoundError } from '../../../../../helpers/errors';
import { MESSAGES } from '../../../../../constants/messages';
import { genKey } from '../../../../../utils/genKey';
import type {
  HoaDonBodyInput,
  HoaDonChiTietInput,
  HoaDonListQuery,
} from '../../../../../validators/accounting/banHang/hoaDonBanHang.validator';

/**
 * Số chứng từ kế tiếp = MAX(so_ct kiểu số) + 1 trên m81.
 * Chỉ xét các so_ct toàn chữ số để tránh lỗi ép kiểu khi có mã phi số.
 */
export async function nextSoCt(db: PrismaClient): Promise<string> {
  const rows = await db.$queryRaw<{ next_so_ct: string }[]>`
    SELECT (COALESCE(MAX(so_ct::INTEGER), 0) + 1)::text AS next_so_ct
    FROM m81
    WHERE so_ct ~ '^[0-9]+$'
  `;
  return rows[0]?.next_so_ct ?? '1';
}

/** GET danh sách hóa đơn + lọc + kèm tên khách hàng (thay LEFT JOIN dmkh). */
export async function listHoaDon(db: PrismaClient, q: HoaDonListQuery) {
  const and: Prisma.m81WhereInput[] = [];
  if (q.ma_dvcs) and.push({ ma_dvcs: q.ma_dvcs });
  if (q.so_ct) and.push({ so_ct: { contains: q.so_ct, mode: 'insensitive' } });
  if (q.ma_kh) and.push({ ma_kh: { contains: q.ma_kh, mode: 'insensitive' } });
  if (q.dien_giai)
    and.push({ dien_giai: { contains: q.dien_giai, mode: 'insensitive' } });
  if (q.trang_thai) and.push({ status: q.trang_thai });
  if (q.nguoi_lap)
    and.push({ user_id0: { contains: q.nguoi_lap, mode: 'insensitive' } });
  if (q.ngay_ct) {
    const d = new Date(q.ngay_ct);
    if (!Number.isNaN(d.getTime())) {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      and.push({ ngay_ct: { gte: d, lt: next } });
    }
  }

  const rows = await db.m81.findMany({
    where: and.length ? { AND: and } : undefined,
    orderBy: [{ ngay_ct: 'desc' }, { so_ct: 'desc' }],
  });

  // Chỉ nạp tên của những khách hàng thực sự xuất hiện (thay LEFT JOIN dmkh).
  const maKhs = [...new Set(rows.map((r) => r.ma_kh))];
  const khs = maKhs.length
    ? await db.dmkh.findMany({
        where: { ma_kh: { in: maKhs } },
        select: { ma_kh: true, ten_kh: true },
      })
    : [];

  const khMap = new Map(khs.map((k) => [k.ma_kh, k.ten_kh]));
  const withName = rows.map((r) => ({
    ...r,
    ten_kh: khMap.get(r.ma_kh) ?? '',
  }));

  // Lọc theo tên khách (trên dữ liệu đã join).
  if (q.ten_kh) {
    const kw = q.ten_kh.toLowerCase();
    return withName.filter((r) => r.ten_kh.toLowerCase().includes(kw));
  }
  return withName;
}

/** GET chi tiết dòng (d81) của 1 hóa đơn + kèm tên vật tư. */
export async function getChiTietHoaDon(db: PrismaClient, sttRec: string) {
  const rows = await db.d81.findMany({
    where: { stt_rec: sttRec },
    orderBy: { line_nbr: 'asc' },
  });
  if (rows.length === 0) return [];

  const maVts = [...new Set(rows.map((r) => r.ma_vt))];
  const vts = await db.dmvt.findMany({
    where: { ma_vt: { in: maVts } },
    select: { ma_vt: true, ten_vt: true },
  });
  const vtMap = new Map(vts.map((v) => [v.ma_vt, v.ten_vt]));

  return rows.map((r) => ({ ...r, ten_vt: vtMap.get(r.ma_vt) ?? '' }));
}

/** Body -> dữ liệu header m81 (không gồm khóa/audit). */
function toHeaderData(body: HoaDonBodyInput) {
  return {
    ma_dvcs: body.ma_dvcs,
    ngay_ct: body.ngay_ct,
    ngay_lct: body.ngay_lct ?? body.ngay_ct,
    so_ct: body.so_ct,
    so_seri: body.so_seri,
    ma_kh: body.ma_kh,
    ma_kh2: body.ma_kh2,
    ong_ba: body.ong_ba,
    dien_giai: body.dien_giai,
    tk: body.tk,
    ma_nt: body.ma_nt,
    ty_gia: body.ty_gia,
    ma_gd: body.ma_gd,
    loai_ct: body.loai_ct,
    ma_nvbh: body.ma_nvbh,
    ma_tt: body.ma_tt,
    ma_ht_tt: body.ma_ht_tt,
    tk_thue_no: body.tk_thue_no,
    tk_thue_co: body.tk_thue_co,
    t_so_luong: body.t_so_luong,
    t_tien_nt2: body.t_tien_nt2,
    t_tien2: body.t_tien2,
    t_ck_nt: body.t_ck_nt,
    t_ck: body.t_ck,
    t_thue_nt: body.t_thue_nt,
    t_thue: body.t_thue,
    t_tt_nt: body.t_tt_nt,
    t_tt: body.t_tt,
    status: body.status,
  };
}

/** 1 dòng validated -> dữ liệu d81 create. */
function toLineData(line: HoaDonChiTietInput, sttRec: string, lineNbr: number) {
  return {
    stt_rec0: genKey(),
    stt_rec: sttRec,
    line_nbr: lineNbr,
    ...line,
  };
}

/** POST tạo mới hóa đơn (transaction: header + các dòng). */
export async function createHoaDon(
  db: PrismaClient,
  body: HoaDonBodyInput,
  userId: string,
) {
  const dup = await db.m81.findFirst({
    where: { so_ct: body.so_ct, ma_dvcs: body.ma_dvcs ?? null },
    select: { stt_rec: true },
  });
  if (dup) throw new ConflictError(`Số chứng từ "${body.so_ct}" đã tồn tại`);

  const stt_rec = genKey();
  const lines = body.chi_tiet.map((l, i) => toLineData(l, stt_rec, i + 1));

  await db.$transaction(async (tx) => {
    await tx.m81.create({
      data: {
        stt_rec,
        ma_ct: 'HB1',
        ...toHeaderData(body),
        user_id0: userId,
        user_id2: userId,
      },
    });
    if (lines.length) await tx.d81.createMany({ data: lines });
  });

  return { stt_rec };
}

/** PUT cập nhật (transaction: update header + ghi lại toàn bộ dòng). */
export async function updateHoaDon(
  db: PrismaClient,
  sttRec: string,
  body: HoaDonBodyInput,
  userId: string,
) {
  const current = await db.m81.findUnique({
    where: { stt_rec: sttRec },
    select: { stt_rec: true },
  });
  if (!current) throw new NotFoundError(MESSAGES.BAN_HANG.HOA_DON_NOT_FOUND);

  const dup = await db.m81.findFirst({
    where: {
      so_ct: body.so_ct,
      ma_dvcs: body.ma_dvcs ?? null,
      stt_rec: { not: sttRec },
    },
    select: { stt_rec: true },
  });
  if (dup) throw new ConflictError(`Số chứng từ "${body.so_ct}" đã tồn tại`);

  const lines = body.chi_tiet.map((l, i) => toLineData(l, sttRec, i + 1));

  await db.$transaction(async (tx) => {
    await tx.m81.update({
      where: { stt_rec: sttRec },
      data: {
        ...toHeaderData(body),
        user_id2: userId,
        datetime2: new Date(),
      },
    });
    await tx.d81.deleteMany({ where: { stt_rec: sttRec } });
    if (lines.length) await tx.d81.createMany({ data: lines });
  });

  return { stt_rec: sttRec };
}

/** DELETE hóa đơn (transaction: xóa dòng + header). */
export async function deleteHoaDon(db: PrismaClient, sttRec: string) {
  const current = await db.m81.findUnique({
    where: { stt_rec: sttRec },
    select: { stt_rec: true },
  });
  if (!current) throw new NotFoundError(MESSAGES.BAN_HANG.HOA_DON_NOT_FOUND);

  await db.$transaction(async (tx) => {
    await tx.d81.deleteMany({ where: { stt_rec: sttRec } });
    await tx.m81.delete({ where: { stt_rec: sttRec } });
  });

  return { stt_rec: sttRec };
}

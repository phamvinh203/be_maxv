import type { Prisma, PrismaClient } from '../../../../../generated/tenant';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../../../../helpers/errors';
import { MESSAGES } from '../../../../../constants/messages';
import { genKey } from '../../../../../utils/genKey';
import {
  TRANG_THAI_DA_GHI_SO,
  type HoaDonBodyInput,
  type HoaDonChiTietInput,
  type HoaDonListQuery,
} from '../../../../../validators/accounting/banHang/hoaDonBanHang.validator';
import { tinhDong, tinhTong } from './tinhTienHoaDon';

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

/** Mã các khách hàng có tên chứa `ten` — để lọc m81 theo tên khách NGAY DƯỚI DB (m81 chỉ giữ mã). */
async function maKhTheoTen(db: PrismaClient, ten: string): Promise<string[]> {
  const khs = await db.dmkh.findMany({
    where: { ten_kh: { contains: ten, mode: 'insensitive' } },
    select: { ma_kh: true },
  });
  return khs.map((k) => k.ma_kh);
}

/**
 * GET danh sách hóa đơn + lọc + kèm tên khách hàng (thay LEFT JOIN dmkh) — PHÂN TRANG phía server:
 * `{ items, total, page, pageSize }`. Mọi điều kiện lọc (kể cả tên khách) chạy dưới DB để `total` và
 * trang trả về khớp nhau; trước đây tải toàn bộ m81 rồi lọc tên khách trong bộ nhớ (vbsec 2026-09-10).
 */
export async function listHoaDon(db: PrismaClient, q: HoaDonListQuery) {
  const and: Prisma.m81WhereInput[] = [];
  if (q.q) {
    const maKhs = await maKhTheoTen(db, q.q);
    and.push({
      OR: [
        { so_ct: { contains: q.q, mode: 'insensitive' } },
        { ma_kh: { contains: q.q, mode: 'insensitive' } },
        { dien_giai: { contains: q.q, mode: 'insensitive' } },
        ...(maKhs.length ? [{ ma_kh: { in: maKhs } }] : []),
      ],
    });
  }
  if (q.ten_kh) and.push({ ma_kh: { in: await maKhTheoTen(db, q.ten_kh) } });
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

  const where = and.length ? { AND: and } : undefined;
  const [total, rows] = await Promise.all([
    db.m81.count({ where }),
    db.m81.findMany({
      where,
      // `stt_rec` chốt thứ tự các dòng trùng ngày + số — thiếu nó thì một dòng có thể nhảy trang.
      orderBy: [{ ngay_ct: 'desc' }, { so_ct: 'desc' }, { stt_rec: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  // Chỉ nạp tên của những khách hàng thực sự xuất hiện trong trang (thay LEFT JOIN dmkh).
  const maKhs = [...new Set(rows.map((r) => r.ma_kh))];
  const khs = maKhs.length
    ? await db.dmkh.findMany({
        where: { ma_kh: { in: maKhs } },
        select: { ma_kh: true, ten_kh: true },
      })
    : [];

  const khMap = new Map(khs.map((k) => [k.ma_kh, k.ten_kh]));
  const items = rows.map((r) => ({
    ...r,
    ten_kh: khMap.get(r.ma_kh) ?? '',
  }));
  return { items, total, page: q.page, pageSize: q.pageSize };
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
    status: body.status,
  };
}

/** 1 dòng validated -> dữ liệu d81 create (chưa gồm các cột tiền — xem `dungDongVaTong`). */
function toLineData(line: HoaDonChiTietInput, sttRec: string, lineNbr: number) {
  return {
    stt_rec0: genKey(),
    stt_rec: sttRec,
    line_nbr: lineNbr,
    ...line,
  };
}

/**
 * Thuế suất theo mã thuế, đọc từ danh mục `dmthue` — client không tự đặt được (FE cũng không cho sửa
 * tay, luôn lấy `ty_le` của mã đã chọn). Mã không có trong danh mục -> 0, như FE.
 */
async function thueSuatTheoMa(
  db: PrismaClient,
  chiTiet: HoaDonChiTietInput[],
): Promise<Map<string, number>> {
  const ma = [
    ...new Set(chiTiet.map((l) => l.ma_thue).filter((m): m is string => !!m)),
  ];
  if (ma.length === 0) return new Map();
  const rows = await db.dmthue.findMany({
    where: { ma_thue: { in: ma } },
    select: { ma_thue: true, ty_le: true },
  });
  return new Map(rows.map((r) => [r.ma_thue, Number(r.ty_le ?? 0)]));
}

/**
 * Dòng d81 + tổng m81 với MỌI số tiền do server tính từ input thô (`tinhTienHoaDon.ts`) — vbsec
 * 2026-09-10: trước đây lưu nguyên tổng tiền/chiết khấu/thuế client gửi.
 */
async function dungDongVaTong(
  db: PrismaClient,
  body: HoaDonBodyInput,
  sttRec: string,
) {
  const thueSuat = await thueSuatTheoMa(db, body.chi_tiet);
  const dong = body.chi_tiet.map((l, i) => {
    const thue_suat = l.ma_thue ? (thueSuat.get(l.ma_thue) ?? 0) : 0;
    return {
      ...toLineData(l, sttRec, i + 1),
      thue_suat,
      ...tinhDong({ ...l, thue_suat }, body.ty_gia),
    };
  });
  return { dong, tong: tinhTong(dong) };
}

/**
 * Mã khách hàng và mọi mã hàng trên hóa đơn phải có trong danh mục (vbsec 2026-09-10): trước đây lưu được
 * mã không tồn tại -> chứng từ mồ côi (mất tên khách/hàng). Có khóa ngoại ở DB (hrmTenantConstraints.ts)
 * thì đây là chỗ báo 400 nói rõ mã nào, thay vì để khóa ngoại ném lỗi 500 lúc ghi.
 */
async function kiemMaDanhMuc(db: PrismaClient, body: HoaDonBodyInput) {
  const maVt = [...new Set(body.chi_tiet.map((l) => l.ma_vt))];
  const [kh, vts] = await Promise.all([
    db.dmkh.findUnique({
      where: { ma_kh: body.ma_kh },
      select: { ma_kh: true },
    }),
    maVt.length
      ? db.dmvt.findMany({
          where: { ma_vt: { in: maVt } },
          select: { ma_vt: true },
        })
      : Promise.resolve([]),
  ]);
  if (!kh) {
    throw new BadRequestError(
      `Mã khách hàng "${body.ma_kh}" không có trong danh mục khách hàng.`,
    );
  }
  const coTrongDanhMuc = new Set(vts.map((v) => v.ma_vt));
  const thieu = maVt.filter((m) => !coTrongDanhMuc.has(m));
  if (thieu.length) {
    throw new BadRequestError(
      `Mã hàng không có trong danh mục hàng hóa: ${thieu.join(', ')}.`,
    );
  }
}

/** Chứng từ đã ghi sổ là số liệu sổ sách — không sửa, không xóa qua màn lập hóa đơn. */
function chanNeuDaGhiSo(status: string) {
  if (status === TRANG_THAI_DA_GHI_SO) {
    throw new ConflictError(MESSAGES.BAN_HANG.HOA_DON_DA_GHI_SO);
  }
}

/**
 * Kiểm trùng số chứng từ `(ma_dvcs, so_ct)` BÊN TRONG transaction ghi, sau khi giữ khóa của đúng cặp đó
 * tới lúc commit.
 *
 * Kiểm ngoài transaction thì hai lượt lưu song song cùng qua bước kiểm rồi cùng ghi (vbsec 2026-09-10,
 * đo thật: 6 lượt song song ra 3 hóa đơn trùng số). Advisory lock thay vì `@@unique`: bảng đang có dữ
 * liệu trùng thì `db push` ràng buộc mới sẽ vỡ trên tenant đó, và unique của Postgres coi các `ma_dvcs`
 * NULL là KHÁC nhau nên không chặn được hóa đơn không có đơn vị cơ sở. Lượt tới sau chờ lượt trước
 * commit rồi mới đọc (READ COMMITTED: mỗi câu lệnh một snapshot mới) nên thấy dòng vừa ghi.
 */
async function khoaVaKiemTrungSoCt(
  tx: Prisma.TransactionClient,
  body: HoaDonBodyInput,
  boQuaSttRec?: string,
) {
  const ma_dvcs = body.ma_dvcs ?? null;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`m81_so_ct:${ma_dvcs ?? ''}:${body.so_ct}`}))`;
  const dup = await tx.m81.findFirst({
    where: {
      so_ct: body.so_ct,
      ma_dvcs,
      ...(boQuaSttRec ? { stt_rec: { not: boQuaSttRec } } : {}),
    },
    select: { stt_rec: true },
  });
  if (dup) throw new ConflictError(`Số chứng từ "${body.so_ct}" đã tồn tại`);
}

/** POST tạo mới hóa đơn (transaction: header + các dòng). */
export async function createHoaDon(
  db: PrismaClient,
  body: HoaDonBodyInput,
  userId: string,
) {
  await kiemMaDanhMuc(db, body);
  const stt_rec = genKey();
  const { dong, tong } = await dungDongVaTong(db, body, stt_rec);

  await db.$transaction(async (tx) => {
    await khoaVaKiemTrungSoCt(tx, body);
    await tx.m81.create({
      data: {
        stt_rec,
        ma_ct: 'HB1',
        ...toHeaderData(body),
        ...tong,
        user_id0: userId,
        user_id2: userId,
      },
    });
    if (dong.length) await tx.d81.createMany({ data: dong });
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
    select: { stt_rec: true, status: true },
  });
  if (!current) throw new NotFoundError(MESSAGES.BAN_HANG.HOA_DON_NOT_FOUND);
  chanNeuDaGhiSo(current.status);

  await kiemMaDanhMuc(db, body);
  const { dong, tong } = await dungDongVaTong(db, body, sttRec);

  await db.$transaction(async (tx) => {
    await khoaVaKiemTrungSoCt(tx, body, sttRec);
    await tx.m81.update({
      where: { stt_rec: sttRec },
      data: {
        ...toHeaderData(body),
        ...tong,
        user_id2: userId,
        datetime2: new Date(),
      },
    });
    await tx.d81.deleteMany({ where: { stt_rec: sttRec } });
    if (dong.length) await tx.d81.createMany({ data: dong });
  });

  return { stt_rec: sttRec };
}

/** DELETE hóa đơn (transaction: xóa dòng + header). */
export async function deleteHoaDon(db: PrismaClient, sttRec: string) {
  const current = await db.m81.findUnique({
    where: { stt_rec: sttRec },
    select: { stt_rec: true, status: true },
  });
  if (!current) throw new NotFoundError(MESSAGES.BAN_HANG.HOA_DON_NOT_FOUND);
  chanNeuDaGhiSo(current.status);

  await db.$transaction(async (tx) => {
    await tx.d81.deleteMany({ where: { stt_rec: sttRec } });
    await tx.m81.delete({ where: { stt_rec: sttRec } });
  });

  return { stt_rec: sttRec };
}

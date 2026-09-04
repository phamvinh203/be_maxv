/**
 * Các truy vấn chỉ-đọc phục vụ việc lập tờ khai 01/GTGT.
 *
 * Application service nhận snapshot hóa đơn và số [22] kỳ trước, không cần biết bảng/view Prisma
 * nào được dùng. Nhờ đó phần điều phối tính toán không phải chứa ORM hay SQL.
 */
import type { Prisma, PrismaClient } from "../../../../generated/tenant";
import { chiaLo } from "../domain/chiaLo";
import type { Chieu } from "../domain/chieuHoaDon";
import type { HoaDonGom } from "../domain/gomHoaDonGtgt";
import { kyLienTruoc, thangKetThuc, truocKy, type Ky, type KyLoai } from "../domain/kySoThue";

const HD_MOI_LO = 5_000;

const SELECT_HD = {
  id: true,
  tthai: true,
  dvtte: true,
  tgia: true,
  tgtcthue: true,
  tgtthue: true,
  detail: true,
} satisfies Prisma.vct50viewSelect;

export interface HoaDonKy {
  rows: HoaDonGom[];
  soLoai: number;
  soThieuDetail: number;
}

/** Đọc hóa đơn kế toán đã chọn kê khai cho một chiều của kỳ. */
export async function docHoaDonCuaKy(
  db: PrismaClient,
  ky: Ky,
  chieu: Chieu,
): Promise<HoaDonKy> {
  const daGan = await db.tokhai_ky_hoa_don.findMany({
    where: { chieu, nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo },
    select: { hoa_don_id: true, ke_khai: true },
  });
  const idKeKhai = daGan.filter((d) => d.ke_khai).map((d) => d.hoa_don_id);
  const soLoai = daGan.length - idKeKhai.length;
  if (idKeKhai.length === 0) return { rows: [], soLoai, soThieuDetail: 0 };

  const doc = (ids: string[]) =>
    chieu === "purchase"
      ? db.vct60view.findMany({ where: { id: { in: ids } }, select: SELECT_HD })
      : db.vct50view.findMany({ where: { id: { in: ids } }, select: SELECT_HD });

  const rows: HoaDonGom[] = [];
  for (const lo of chiaLo(idKeKhai, HD_MOI_LO)) {
    rows.push(...((await doc(lo)) as unknown as HoaDonGom[]));
  }

  const soThieuDetail = chieu === "sold" ? rows.filter((r) => r.detail == null).length : 0;
  return { rows, soLoai, soThieuDetail };
}

export interface Ct22KyTruoc {
  gia: number;
  daChot: boolean;
  ky: Ky;
}

/** Lấy [43] của kỳ gần nhất kết thúc trước kỳ hiện tại để điền [22]. */
export async function layCt22KyTruoc(db: PrismaClient, ky: Ky): Promise<Ct22KyTruoc | null> {
  const truoc = kyLienTruoc(ky);
  const ban = await db.tokhai_gtgt01.findUnique({
    where: { nam_ky_loai_ky_so: { nam: truoc.nam, ky_loai: truoc.kyLoai, ky_so: truoc.kySo } },
    select: { trang_thai: true, ct43: true },
  });
  if (ban) return { gia: Number(ban.ct43), daChot: ban.trang_thai === "chot", ky: truoc };

  const ungVien = await db.tokhai_gtgt01.findMany({
    where: { nam: { gte: ky.nam - 2, lte: ky.nam } },
    select: { nam: true, ky_loai: true, ky_so: true, trang_thai: true, ct43: true },
  });

  let tot: (Ct22KyTruoc & { moc: number }) | null = null;
  for (const r of ungVien) {
    const kyR: Ky = { nam: r.nam, kyLoai: r.ky_loai as KyLoai, kySo: r.ky_so };
    if (!truocKy(kyR, ky)) continue;
    const moc = thangKetThuc(kyR);
    if (tot && moc <= tot.moc) continue;
    tot = { moc, gia: Number(r.ct43), daChot: r.trang_thai === "chot", ky: kyR };
  }
  if (!tot) return null;
  const { moc: _moc, ...ketQua } = tot;
  return ketQua;
}

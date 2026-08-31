/**
 * Vòng đời một bản tờ khai 01/GTGT: tính từ BẢNG KÊ CỦA KỲ -> lưu nháp -> kế toán sửa tay -> chốt.
 *
 * Nguồn số liệu là hóa đơn ĐÃ GÁN KỲ (`tokhai_ky_hoa_don`) và kế toán để `ke_khai = true` — không
 * phải mọi hóa đơn rơi vào khoảng ngày. Kỳ chưa bấm "Kê khai" thì không có gì để tính, và đó là
 * lỗi người dùng thấy được chứ không phải một bản tờ khai rỗng khó hiểu.
 *
 * Mô-đun này CHỈ đọc/ghi DB tenant — không gọi cổng thuế, không nhận token GDT.
 */

import type { PrismaClient, Prisma } from "../../../generated/tenant";
import { kyLienTruoc, type Ky } from "./kySoThue";
import { gomBanRa, gomMuaVao, type HoaDonGom, type HoaDonTreo } from "./gomHoaDonGtgt";
import { tinhGtgt01, type CtGtgt01 } from "./tinhGtgt01";
import type { Chieu } from "./keKhaiKy.service";

export interface GhiDeItem {
  gia: number;
  lyDo?: string;
}

export interface BanToKhai {
  ky: Ky;
  trangThai: "nhap" | "chot";
  ct: CtGtgt01;
  ctMay: CtGtgt01;
  ghiDe: Record<string, GhiDeItem>;
  nguonCt22: "ky_truoc" | "nhap_tay";
  soHdBan: number;
  soHdMua: number;
  soHdKhongKeKhai: number;
  hdThieuDetail: number;
  treo: HoaDonTreo[];
  dieuChinh: { soHd: number; giaTri: number; thue: number };
  tinhLuc: string | null;
}

/** Mọi chỉ tiêu của mẫu — dùng để chặn khóa lạ lọt vào `ghi_de`. */
const CT_HOP_LE = new Set([
  "ct22", "ct23", "ct23a", "ct24", "ct24a", "ct25", "ct26", "ct27", "ct28", "ct29",
  "ct30", "ct31", "ct32", "ct32a", "ct33", "ct34", "ct35", "ct36", "ct37", "ct38",
  "ct39a", "ct40", "ct40a", "ct40b", "ct41", "ct42", "ct43",
]);

const DAI_TOI_DA_LY_DO = 500;

/**
 * Lọc payload `ghi_de` từ FE: chỉ giữ khóa là chỉ tiêu thật và giá trị là số hữu hạn.
 *
 * Đây là cửa DUY NHẤT dữ liệu người dùng đi vào bộ chỉ tiêu, nên không tin gì cả — kể cả tên khóa
 * (`Object.create(null)` chặn luôn `__proto__`). Số 0 và số âm là giá trị HỢP LỆ (điều chỉnh giảm
 * bằng 0, ô tiền âm), chỉ NaN/Infinity/không-phải-số mới bị bỏ.
 */
export function locGhiDeHopLe(raw: unknown): Record<string, GhiDeItem> {
  const out: Record<string, GhiDeItem> = Object.create(null) as Record<string, GhiDeItem>;
  if (!raw || typeof raw !== "object") return out;

  for (const [khoa, giaTri] of Object.entries(raw as Record<string, unknown>)) {
    if (!CT_HOP_LE.has(khoa)) continue;
    if (!giaTri || typeof giaTri !== "object") continue;
    const o = giaTri as Record<string, unknown>;
    const gia = Number(o.gia);
    if (!Number.isFinite(gia)) continue;
    const lyDo = typeof o.lyDo === "string" ? o.lyDo.slice(0, DAI_TOI_DA_LY_DO) : undefined;
    out[khoa] = lyDo === undefined ? { gia } : { gia, lyDo };
  }
  return out;
}

/** Các cột engine cần đọc — giữ hẹp vì `detail` là JSON nặng. */
const SELECT_HD = {
  id: true,
  tthai: true,
  dvtte: true,
  tgia: true,
  tgtcthue: true,
  tgtthue: true,
  detail: true,
} satisfies Prisma.vct50viewSelect;

/**
 * Hóa đơn của kỳ theo chiều, kèm hai con số phục vụ cảnh báo: số tờ kế toán đã loại và số tờ bán
 * ra thiếu chi tiết.
 *
 * Đếm `detail == null` thẳng ở đây thay vì soi chuỗi lý do trong `treo` — chuỗi đó là câu hiển thị
 * cho người đọc, đổi chữ một cái là con số sai âm thầm. Chỉ bán ra mới cần `detail` để tách thuế
 * suất; mua vào chỉ lấy tổng.
 */
async function docHoaDonCuaKy(
  db: PrismaClient,
  ky: Ky,
  chieu: Chieu,
): Promise<{ rows: HoaDonGom[]; soLoai: number; soThieuDetail: number }> {
  const daGan = await db.tokhai_ky_hoa_don.findMany({
    where: { chieu, nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo },
    select: { hoa_don_id: true, ke_khai: true },
  });
  const idKeKhai = daGan.filter((d) => d.ke_khai).map((d) => d.hoa_don_id);
  const soLoai = daGan.length - idKeKhai.length;
  if (idKeKhai.length === 0) return { rows: [], soLoai, soThieuDetail: 0 };

  const where = { id: { in: idKeKhai } };
  const rows = (
    chieu === "purchase"
      ? await db.vct60view.findMany({ where, select: SELECT_HD })
      : await db.vct50view.findMany({ where, select: SELECT_HD })
  ) as unknown as HoaDonGom[];

  const soThieuDetail = chieu === "sold" ? rows.filter((r) => r.detail == null).length : 0;
  return { rows, soLoai, soThieuDetail };
}

/** [22] của kỳ này = [43] của bản ĐÃ CHỐT kỳ liền trước; chưa có -> null (kế toán nhập tay). */
export async function layCt22KyTruoc(db: PrismaClient, ky: Ky): Promise<number | null> {
  const truoc = kyLienTruoc(ky);
  const ban = await db.tokhai_gtgt01.findUnique({
    where: { nam_ky_loai_ky_so: { nam: truoc.nam, ky_loai: truoc.kyLoai, ky_so: truoc.kySo } },
    select: { trang_thai: true, ct43: true },
  });
  // Chỉ nối từ bản ĐÃ CHỐT: bản nháp còn tính lại được, nối vào là số kỳ này chạy theo kỳ trước.
  if (!ban || ban.trang_thai !== "chot") return null;
  return Number(ban.ct43);
}

/**
 * Tính lại toàn bộ chỉ tiêu từ bảng kê của kỳ rồi ghi đè bản nháp.
 *
 * Ô đã `ghi_de` được GIỮ NGUYÊN và áp lại lên số máy — đây là lý do một lượt "Tính lại" không xóa
 * công sức sửa tay của kế toán.
 */
export async function tinhVaLuu(db: PrismaClient, ky: Ky): Promise<BanToKhai> {
  const hienCo = await db.tokhai_gtgt01.findUnique({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
  });
  if (hienCo?.trang_thai === "chot") throw new BanDaChotError();
  const ghiDe = locGhiDeHopLe(hienCo?.ghi_de);

  const [ban, mua] = await Promise.all([
    docHoaDonCuaKy(db, ky, "sold"),
    docHoaDonCuaKy(db, ky, "purchase"),
  ]);
  if (ban.rows.length === 0 && mua.rows.length === 0) throw new KyChuaKeKhaiError();

  const banRa = gomBanRa(ban.rows);
  const muaVao = gomMuaVao(mua.rows);

  // [22]: ô kế toán đã ghi đè thắng; chưa ghi đè thì nối từ [43] kỳ trước đã chốt.
  const ct22KyTruoc = ghiDe.ct22 ? null : await layCt22KyTruoc(db, ky);
  const nhapTay: Record<string, number> = {};
  for (const [khoa, item] of Object.entries(ghiDe)) nhapTay[khoa] = item.gia;
  if (ct22KyTruoc !== null) nhapTay.ct22 = ct22KyTruoc;

  const ctMay = tinhGtgt01({ banRa: banRa.tong, muaVao, nhapTay: {} });
  const ct = tinhGtgt01({ banRa: banRa.tong, muaVao, nhapTay });
  // Ô ghi đè KHÔNG nằm trong công thức (vd [26] kế toán tự sửa) vẫn phải hiện đúng số đã sửa.
  for (const [khoa, item] of Object.entries(ghiDe)) ct[khoa] = item.gia;

  const nguonCt22: "ky_truoc" | "nhap_tay" = ct22KyTruoc !== null ? "ky_truoc" : "nhap_tay";
  const soHdKhongKeKhai = ban.soLoai + mua.soLoai;
  const duLieu = {
    trang_thai: "nhap",
    ct: ct as Prisma.InputJsonValue,
    ct_may: ctMay as Prisma.InputJsonValue,
    // `GhiDeItem.lyDo` là optional nên không khớp `InputJsonValue` (không nhận `undefined`);
    // cast qua `unknown` — giá trị thật luôn serialize được, `locGhiDeHopLe` đã lọc sạch.
    ghi_de: ghiDe as unknown as Prisma.InputJsonValue,
    ct22: ct.ct22,
    ct40: ct.ct40,
    ct43: ct.ct43,
    nguon_ct22: nguonCt22,
    so_hd_ban: banRa.soHd,
    so_hd_mua: muaVao.soHd,
    so_hd_khong_ke_khai: soHdKhongKeKhai,
    hd_thieu_detail: ban.soThieuDetail,
    tinh_luc: new Date(),
  };

  const luu = await db.tokhai_gtgt01.upsert({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
    create: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo, ...duLieu },
    update: duLieu,
  });

  return {
    ky,
    trangThai: "nhap",
    ct,
    ctMay,
    ghiDe,
    nguonCt22,
    soHdBan: banRa.soHd,
    soHdMua: muaVao.soHd,
    soHdKhongKeKhai,
    hdThieuDetail: ban.soThieuDetail,
    treo: [...banRa.treo, ...muaVao.treo],
    dieuChinh: banRa.dieuChinh,
    tinhLuc: luu.tinh_luc?.toISOString() ?? null,
  };
}

export async function docBan(db: PrismaClient, ky: Ky): Promise<BanToKhai | null> {
  const row = await db.tokhai_gtgt01.findUnique({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
  });
  if (!row) return null;
  return {
    ky,
    trangThai: row.trang_thai === "chot" ? "chot" : "nhap",
    ct: (row.ct ?? {}) as CtGtgt01,
    ctMay: (row.ct_may ?? {}) as CtGtgt01,
    ghiDe: locGhiDeHopLe(row.ghi_de),
    nguonCt22: row.nguon_ct22 === "ky_truoc" ? "ky_truoc" : "nhap_tay",
    soHdBan: row.so_hd_ban,
    soHdMua: row.so_hd_mua,
    soHdKhongKeKhai: row.so_hd_khong_ke_khai,
    hdThieuDetail: row.hd_thieu_detail,
    // `treo`/`dieuChinh` là kết quả của lượt TÍNH, không lưu DB — đọc lại bản cũ thì để rỗng,
    // bấm "Tính lại" sẽ có ngay.
    treo: [],
    dieuChinh: { soHd: 0, giaTri: 0, thue: 0 },
    tinhLuc: row.tinh_luc?.toISOString() ?? null,
  };
}

/** Lưu ô sửa tay rồi tính lại — bản đã chốt phải mở khóa trước. */
export async function luuGhiDe(
  db: PrismaClient,
  ky: Ky,
  ghiDeMoi: Record<string, GhiDeItem>,
): Promise<BanToKhai> {
  const row = await db.tokhai_gtgt01.findUnique({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
    select: { trang_thai: true },
  });
  if (!row) throw new ChuaCoBanError();
  if (row.trang_thai === "chot") throw new BanDaChotError();

  await db.tokhai_gtgt01.update({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
    data: { ghi_de: locGhiDeHopLe(ghiDeMoi) as unknown as Prisma.InputJsonValue },
  });
  return tinhVaLuu(db, ky);
}

export async function doiTrangThai(
  db: PrismaClient,
  ky: Ky,
  trangThai: "nhap" | "chot",
): Promise<BanToKhai> {
  const ban = await docBan(db, ky);
  if (!ban) throw new ChuaCoBanError();
  await db.tokhai_gtgt01.update({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
    data: { trang_thai: trangThai },
  });
  return { ...ban, trangThai };
}

/** Danh sách kỳ đã lập, mới nhất trước. */
export async function danhSachKy(db: PrismaClient) {
  const rows = await db.tokhai_gtgt01.findMany({
    orderBy: [{ nam: "desc" }, { ky_so: "desc" }],
    take: 100,
    select: {
      nam: true,
      ky_loai: true,
      ky_so: true,
      trang_thai: true,
      ct40: true,
      ct43: true,
      tinh_luc: true,
    },
  });
  return rows.map((r) => ({
    nam: r.nam,
    kyLoai: r.ky_loai as Ky["kyLoai"],
    kySo: r.ky_so,
    trangThai: r.trang_thai,
    ct40: Number(r.ct40),
    ct43: Number(r.ct43),
    tinhLuc: r.tinh_luc?.toISOString() ?? null,
  }));
}

export class KyChuaKeKhaiError extends Error {
  constructor() {
    super(
      'Kỳ này chưa có hóa đơn nào được kê khai. Sang màn Hóa đơn điện tử bấm "Kê khai" cho kỳ này trước.',
    );
  }
}

export class BanDaChotError extends Error {
  constructor() {
    super("Tờ khai kỳ này đã chốt. Mở khóa trước khi sửa.");
  }
}

export class ChuaCoBanError extends Error {
  constructor() {
    super('Kỳ này chưa có bản tờ khai nào. Bấm "Lập tờ khai" trước.');
  }
}

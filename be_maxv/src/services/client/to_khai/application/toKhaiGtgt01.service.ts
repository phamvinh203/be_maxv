/**
 * Vòng đời một bản tờ khai 01/GTGT: tính từ BẢNG KÊ CỦA KỲ -> lưu nháp -> kế toán sửa tay -> chốt.
 *
 * Nguồn số liệu là hóa đơn ĐÃ GÁN KỲ (`tokhai_ky_hoa_don`) và kế toán để `ke_khai = true` — không
 * phải mọi hóa đơn rơi vào khoảng ngày. Kỳ chưa bấm "Kê khai" thì không có gì để tính, và đó là
 * lỗi người dùng thấy được chứ không phải một bản tờ khai rỗng khó hiểu.
 *
 * Mô-đun này CHỈ đọc/ghi DB tenant — không gọi cổng thuế, không nhận token GDT.
 */

import type { PrismaClient, Prisma } from "../../../../generated/tenant";
import type { Ky } from "../domain/kySoThue";
import { gomBanRa, gomMuaVao, type HoaDonTreo } from "../domain/gomHoaDonGtgt";
import { tinhGtgt01, CT_NHAP_TAY, type CtGtgt01 } from "../domain/tinhGtgt01";
import { catMoTa, dungPhuLuc204, type PhuLuc204 } from "../domain/phuLuc204";
import { soatToKhai } from "../domain/soatToKhai";
import { docLogDongBo, phuKyTuLog } from "../infrastructure/phuKy";
import { layThayTheHut } from "../infrastructure/soatToKhai.repository";
import { docHoaDonCuaKy, layCt22KyTruoc } from "../infrastructure/toKhaiGtgt01.reader";

/** Nguồn của chỉ tiêu [22]. `ky_truoc_nhap` = kỳ trước còn là bản nháp nên [43] còn có thể đổi. */
export type NguonCt22 = "ky_truoc" | "ky_truoc_nhap" | "nhap_tay";

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
  /** [22] ở đâu ra: nối từ kỳ trước ĐÃ CHỐT | từ kỳ trước còn NHÁP (số có thể đổi) | nhập tay. */
  nguonCt22: NguonCt22;
  /** Kỳ mà [22] nối từ đó — `null` khi nhập tay. Có thể KHÁC loại kỳ hiện tại (đổi tháng<->quý). */
  kyNguonCt22: Ky | null;
  soHdBan: number;
  soHdMua: number;
  soHdKhongKeKhai: number;
  hdThieuDetail: number;
  treo: HoaDonTreo[];
  dieuChinh: { soHd: number; giaTri: number; thue: number };
  /** Phụ lục giảm thuế NQ 204/2025 của kỳ; `null` = kỳ không có hàng 8% BÁN RA nên không phải nộp. */
  phuLuc: PhuLuc204 | null;
  /** Câu cảnh báo cho màn hình: số vẫn tính ra, nhưng có chỗ đáng ngờ cần người xem lại. */
  canhBao: string[];
  /**
   * Ô kế toán được phép sửa tay. Server gửi kèm thay vì để client tự đoán: chính server là bên lọc
   * `ghi_de` theo danh sách này, nên giữ hai bản là mời chúng trôi lệch âm thầm — ô client cho gõ
   * mà server không nhận thì người dùng thấy "Đã lưu" rồi số nhảy về như cũ.
   */
  oSuaDuoc: readonly string[];
  tinhLuc: string | null;
}

/**
 * Ô được phép ghi đè — lấy thẳng từ `CT_NHAP_TAY` để không có bản sao thứ hai trôi lệch.
 *
 * Ô công thức thuần ([27] [28] [34] [35] [36] [40] [40a] [41] [43]) KHÔNG nằm trong đây: chúng là
 * tổng của các ô khác, ghi đè chỉ tạo ra tờ khai tự mâu thuẫn. Muốn đổi chúng thì sửa ô nguồn.
 */
const CT_HOP_LE: ReadonlySet<string> = new Set<string>(CT_NHAP_TAY);

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

  // [22] không phụ thuộc hóa đơn của kỳ này nên đi cùng chuyến, khỏi thêm một lượt chờ nối đuôi.
  const [ban, mua, ct22KyTruoc] = await Promise.all([
    docHoaDonCuaKy(db, ky, "sold"),
    docHoaDonCuaKy(db, ky, "purchase"),
    ghiDe.ct22 ? Promise.resolve(null) : layCt22KyTruoc(db, ky),
  ]);
  if (ban.rows.length === 0 && mua.rows.length === 0) throw new KyChuaKeKhaiError();

  const banRa = gomBanRa(ban.rows);
  const muaVao = gomMuaVao(mua.rows);

  // [22]: ô kế toán đã ghi đè thắng; chưa ghi đè thì nối từ [43] kỳ trước (chốt hay nháp đều lấy,
  // nguồn ghi lại ở `nguonCt22` để màn hình cảnh báo khi kỳ trước còn nháp).
  const nhapTay: Record<string, number> = {};
  for (const [khoa, item] of Object.entries(ghiDe)) nhapTay[khoa] = item.gia;
  if (ct22KyTruoc !== null) nhapTay.ct22 = ct22KyTruoc.gia;

  // Phụ lục dựng trước để `soatToKhai` đối chiếu [33] với công thức kiểm của HTKK
  // (`làm tròn([32] x 10%) - cột 6 phụ lục`); bản thân [33] cộng thuế từng hóa đơn.
  const phuLucMoi = dungPhuLuc204(banRa, muaVao);

  const ctMay = tinhGtgt01({ banRa: banRa.tong, muaVao, nhapTay: {} });
  const ct = tinhGtgt01({ banRa: banRa.tong, muaVao, nhapTay });

  const nguonCt22: NguonCt22 =
    ct22KyTruoc === null ? "nhap_tay" : ct22KyTruoc.daChot ? "ky_truoc" : "ky_truoc_nhap";
  const soHdKhongKeKhai = ban.soLoai + mua.soLoai;

  // Kỳ này VÀ kỳ nguồn [22] đã đồng bộ đủ hóa đơn chưa — đọc `sync_log` MỘT lần cho cả hai.
  // Kỳ nguồn chỉ xét khi [22] THẬT SỰ nối từ đó: kế toán đã ghi đè [22] thì số kia không còn đi vào
  // tờ khai, cảnh báo lúc ấy chỉ gây nhiễu.
  // Tờ thay thế bỏ sót dòng hàng — hỏi cả hai chiều, đi cùng chuyến với phần độ phủ.
  const [thayTheHutBan, thayTheHutMua, logDongBo] = await Promise.all([
    layThayTheHut(db, ky, "sold"),
    layThayTheHut(db, ky, "purchase"),
    docLogDongBo(db),
  ]);
  const thieuDuLieuKyNay = phuKyTuLog(logDongBo, ky).phanThieu;
  const thieuDuLieuKyNguonCt22 =
    ct22KyTruoc === null ? null : phuKyTuLog(logDongBo, ct22KyTruoc.ky).phanThieu;

  // Soát là hàm THUẦN (`soatToKhai.ts`) — ngưỡng làm tròn là chỗ dễ sai nhất, tách ra để test được
  // không cần Postgres.
  const canhBao = soatToKhai({
    ct,
    ctMay,
    soHdBan: banRa.soHd,
    biLoai: {
      soHd: banRa.biLoai.soHd + muaVao.biLoai.soHd,
      giaTri: banRa.biLoai.giaTri + muaVao.biLoai.giaTri,
    },
    thayTheHut: [...thayTheHutBan, ...thayTheHutMua],
    giamThue10: phuLucMoi.banRa.thueDuocGiam,
    kyNay: ky,
    thieuDuLieuKyNay,
    kyNguonCt22: ct22KyTruoc?.ky ?? null,
    thieuDuLieuKyNguonCt22,
  });

  // Phụ lục tính lại từ hóa đơn, NHƯNG hai ô mô tả hàng hóa giữ nguyên nếu kế toán đã sửa —
  // họ biết gọi gọn thế nào cho cơ quan thuế dễ đọc, tính lại mà xóa mất là mất công gõ lại.
  const phuLucCu = (hienCo?.phu_luc ?? null) as PhuLuc204 | null;
  const phuLuc: PhuLuc204 | null = phuLucMoi.rong
    ? null
    : {
        ...phuLucMoi,
        // `phu_luc` là JSON không ràng buộc shape (bản cũ, hoặc ai đó sửa tay DB) nên phải `?.`
        // đủ tầng — thiếu một tầng là "Tính lại" ném TypeError, kỳ đó hỏng hẳn.
        // `??` chứ không `||`: kế toán xóa trắng mô tả là ý định thật, `||` sẽ điền lại số máy.
        // `catMoTa` cả ở đây: bản LƯU TRƯỚC khi có trần 75 ký tự vẫn mang mô tả dài, giữ nguyên
        // là nó sống mãi. Cắt lúc tính lại thì dữ liệu cũ tự sạch dần, và màn hình / Excel / XML
        // cùng thấy một chuỗi.
        muaVao: {
          ...phuLucMoi.muaVao,
          tenHang: catMoTa(phuLucCu?.muaVao?.tenHang ?? phuLucMoi.muaVao.tenHang),
        },
        banRa: {
          ...phuLucMoi.banRa,
          tenHang: catMoTa(phuLucCu?.banRa?.tenHang ?? phuLucMoi.banRa.tenHang),
        },
      };
  // Chỉ những cột là KẾT QUẢ của lượt tính. `ghi_de` và `trang_thai` cố tình đứng ngoài:
  //
  //   - `ghi_de` là dữ liệu kế toán nhập, `tinhVaLuu` chỉ ĐỌC nó. Ghi lại bản đã qua
  //     `locGhiDeHopLe` sẽ lặng lẽ xóa vĩnh viễn những khóa mà bản mới không còn nhận (đổi tập ô
  //     cho phép ghi đè là xóa sạch ô cũ, không log, không hoàn tác) — và cũng nuốt mất ô mà
  //     người khác vừa lưu trong lúc lượt tính này đang chạy. Đường ghi chính thức là `luuGhiDe`.
  //   - `trang_thai` nằm trong `update` thì một lượt "Tính lại" chạy song song với "Chốt" sẽ đẩy
  //     bản vừa chốt về `nhap` (guard ở đầu hàm đọc trạng thái từ trước đó nên không bắt được).
  const duLieu = {
    ct: ct as Prisma.InputJsonValue,
    ct_may: ctMay as Prisma.InputJsonValue,
    ct22: ct.ct22,
    ct40: ct.ct40,
    ct43: ct.ct43,
    nguon_ct22: nguonCt22,
    so_hd_ban: banRa.soHd,
    so_hd_mua: muaVao.soHd,
    so_hd_khong_ke_khai: soHdKhongKeKhai,
    hd_thieu_detail: ban.soThieuDetail,
    phu_luc: (phuLuc ?? null) as unknown as Prisma.InputJsonValue,
    // Lưu lại để mở lại bản cũ vẫn thấy đủ — trước đây hai cột này KHÔNG lưu, đọc lại bản đã lưu
    // ra rỗng, mất luôn cảnh báo thật (vd "N hóa đơn thay thế hụt tiền") cho tới lượt "Tính lại"
    // kế tiếp. Xem `docBan`.
    canh_bao: canhBao as unknown as Prisma.InputJsonValue,
    dieu_chinh: banRa.dieuChinh as unknown as Prisma.InputJsonValue,
    tinh_luc: new Date(),
  };

  const luu = await db.tokhai_gtgt01.upsert({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
    create: {
      nam: ky.nam,
      ky_loai: ky.kyLoai,
      ky_so: ky.kySo,
      trang_thai: "nhap",
      // `GhiDeItem.lyDo` là optional nên không khớp `InputJsonValue` (không nhận `undefined`);
      // cast qua `unknown` — giá trị thật luôn serialize được, `locGhiDeHopLe` đã lọc sạch.
      ghi_de: ghiDe as unknown as Prisma.InputJsonValue,
      ...duLieu,
    },
    update: duLieu,
  });

  return {
    ky,
    trangThai: "nhap",
    ct,
    ctMay,
    ghiDe,
    nguonCt22,
    kyNguonCt22: ct22KyTruoc?.ky ?? null,
    soHdBan: banRa.soHd,
    soHdMua: muaVao.soHd,
    soHdKhongKeKhai,
    hdThieuDetail: ban.soThieuDetail,
    treo: [...banRa.treo, ...muaVao.treo],
    dieuChinh: banRa.dieuChinh,
    phuLuc,
    canhBao,
    oSuaDuoc: CT_NHAP_TAY,
    tinhLuc: luu.tinh_luc?.toISOString() ?? null,
  };
}

/**
 * Cắt hai ô mô tả của bản phụ lục ĐỌC TỪ DB.
 *
 * Kỳ lưu trước khi có trần 75 ký tự vẫn mang mô tả dài; cắt ngay lúc đọc để màn hình và file Excel
 * thấy đúng thứ sẽ nằm trong file XML nộp thuế, không phải chờ bấm "Tính lại".
 *
 * KHÔNG ghi ngược xuống DB ở đây — `docBan` chỉ đọc. Bản trong DB được dọn ở lượt tính lại.
 */
function catMoTaPhuLuc(pl: PhuLuc204 | null): PhuLuc204 | null {
  if (!pl) return null;
  return {
    ...pl,
    muaVao: { ...pl.muaVao, tenHang: catMoTa(pl.muaVao?.tenHang ?? "") },
    banRa: { ...pl.banRa, tenHang: catMoTa(pl.banRa?.tenHang ?? "") },
  };
}

/** Đọc `canh_bao` từ DB — `null` (bản tạo trước khi có cột này) hoặc dạng lạ -> rỗng, không throw. */
function docCanhBao(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Đọc `dieu_chinh` từ DB — `null` (bản tạo trước khi có cột này) hoặc thiếu field -> 0, không throw. */
function docDieuChinh(v: unknown): { soHd: number; giaTri: number; thue: number } {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    soHd: typeof o.soHd === "number" ? o.soHd : 0,
    giaTri: typeof o.giaTri === "number" ? o.giaTri : 0,
    thue: typeof o.thue === "number" ? o.thue : 0,
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
    nguonCt22:
      row.nguon_ct22 === "ky_truoc" || row.nguon_ct22 === "ky_truoc_nhap"
        ? row.nguon_ct22
        : "nhap_tay",
    // Kỳ nguồn là kết quả của lượt TÍNH, không lưu DB — bấm "Tính lại" sẽ có.
    kyNguonCt22: null,
    soHdBan: row.so_hd_ban,
    soHdMua: row.so_hd_mua,
    soHdKhongKeKhai: row.so_hd_khong_ke_khai,
    hdThieuDetail: row.hd_thieu_detail,
    // `treo` là kết quả của lượt TÍNH, KHÔNG lưu DB — đọc lại bản cũ thì để rỗng, bấm "Tính lại"
    // sẽ có ngay (chưa có UI hiển thị nên chưa cần lưu). `canhBao`/`dieuChinh` NGƯỢC LẠI — đây là
    // số liệu người dùng cần thấy thật, không phải hiệu ứng phụ của một lượt tính, nên LƯU LẠI
    // (xem `tinhVaLuu`); đọc từ cột, không còn đoán bừa mỗi lần mở lại bản cũ.
    treo: [],
    dieuChinh: docDieuChinh(row.dieu_chinh),
    phuLuc: catMoTaPhuLuc((row.phu_luc ?? null) as PhuLuc204 | null),
    canhBao: docCanhBao(row.canh_bao),
    oSuaDuoc: CT_NHAP_TAY,
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

/**
 * Sửa hai ô mô tả hàng hóa của phụ lục. Chỉ đụng `tenHang`, KHÔNG cho sửa số: số phải luôn khớp
 * hóa đơn, muốn đổi thì sửa bảng kê rồi tính lại.
 */
export async function luuTenHangPhuLuc(
  db: PrismaClient,
  ky: Ky,
  ten: { muaVao?: string; banRa?: string },
): Promise<BanToKhai> {
  const ban = await docBan(db, ky);
  if (!ban) throw new ChuaCoBanError();
  if (ban.trangThai === "chot") throw new BanDaChotError();
  if (!ban.phuLuc) throw new Error("Kỳ này không có hàng được giảm thuế nên không có phụ lục.");

  const CAT = 500;
  const phuLuc: PhuLuc204 = {
    ...ban.phuLuc,
    muaVao: {
      ...ban.phuLuc.muaVao,
      tenHang: (ten.muaVao ?? ban.phuLuc.muaVao.tenHang).slice(0, CAT),
    },
    banRa: {
      ...ban.phuLuc.banRa,
      tenHang: (ten.banRa ?? ban.phuLuc.banRa.tenHang).slice(0, CAT),
    },
  };

  await db.tokhai_gtgt01.update({
    where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
    data: { phu_luc: phuLuc as unknown as Prisma.InputJsonValue },
  });
  return { ...ban, phuLuc };
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
    // Thêm `ky_loai` vì T3/2026 và Q3/2026 cùng `ky_so = 3` — thiếu nó thì hai dòng xen kẽ tùy lúc.
    orderBy: [{ nam: "desc" }, { ky_loai: "asc" }, { ky_so: "desc" }],
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

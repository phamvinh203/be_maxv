import { formatDateVN } from "./dateUtils";
import { stripFloatNoise } from "./format";
import { traCuuNcc } from "./traCuuNcc";
import type { DetailRow } from "./types";

/** Ép về string an toàn (null/undefined -> ""). */
function s(v: unknown): string {
  return v == null ? "" : String(v);
}

/** Ép về number; rỗng/không phải số -> undefined (để cột tiền hiện trống thay vì 0/NaN). */
function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

/** Lấy field đầu tiên có giá trị trong danh sách key ứng viên (GDT đôi khi đổi tên field). */
function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

/**
 * Giá trị mặc định cho phần "dòng hàng hóa" khi hóa đơn không có mảng hàng. Không cần annotate:
 * `{ ...header, ...EMPTY_LINE }` được TS kiểm tra đủ field so với `DetailRow` ngay tại chỗ return.
 */
const EMPTY_LINE = {
  maVt: "",
  tenHang: "",
  dvt: "",
  soLuong: undefined,
  gia: undefined,
  tienCk: undefined,
  tienChuaThue: undefined,
  // Năm cột tiền thuế/chiết khấu luôn phải ra CON SỐ (0 = không có), kể cả hóa đơn không có dòng hàng.
  tlCktm: 0,
  thueSuat: "",
  tinhChat: "",
  thueDong: 0,
  tienSauThueDong: 0,
};

/**
 * Thuế suất GDT ("10%", "10", "8%"…) -> hệ số nhân (0.1). Trả `undefined` cho mã KHÔNG phải con số
 * ("KCT", "KKKNT", "\\"…) và cho ô rỗng — những dòng đó không có tiền thuế để suy ra.
 * Chuỗi rỗng phải chặn riêng: `Number("")` là 0 chứ không phải NaN, để lọt sẽ thành "thuế suất 0%".
 */
function thueSuatRate(v: string): number | undefined {
  const raw = v.replace("%", "").trim();
  if (raw === "") return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n / 100;
}

/**
 * Bảng tra "thuế suất -> hệ số thuế THỰC TẾ của hóa đơn này", dựng từ `thttltsuat` — mảng GDT tổng
 * hợp tiền theo từng mức thuế suất: `[{ tsuat: "KKKNT", thtien: 1500000, tthue: 0 }]`.
 *
 * Đây là nguồn ĐÚNG NHẤT để suy tiền thuế theo dòng, hơn hẳn việc đọc con số trong chuỗi thuế suất:
 *  - mức KHÔNG phải phần trăm ("KKKNT", "KCT", "\\") vẫn ra hệ số đúng — bằng 0 — thay vì không
 *    tính được rồi bỏ trống ô;
 *  - hệ số lấy từ chính số tiền của hóa đơn nên cộng cả cột khớp `tgtthue`, không lệch vì làm tròn.
 *
 * Bỏ qua nhóm có `thtien` = 0 (không chia được) để nơi gọi lùi về đọc chuỗi thuế suất.
 */
function taxRateByLabel(detail: Record<string, unknown>): Map<string, number> {
  const out = new Map<string, number>();
  const groups = Array.isArray(detail.thttltsuat) ? detail.thttltsuat : [];
  for (const raw of groups) {
    const g = (raw ?? {}) as Record<string, unknown>;
    const label = s(pick(g, "ltsuat", "tsuat", "thuesuat"));
    const base = num(g.thtien);
    const tax = num(g.tthue);
    if (!label || base === undefined || tax === undefined || base === 0) continue;
    out.set(label, tax / base);
  }
  return out;
}

/**
 * `nbcks` / `cqtcks` của GDT là một CHUỖI JSON mô tả chữ ký số:
 * `{"Subject":"CN=CỤC THUẾ,…","SerialNumber":"…","Issuer":"…","SigningTime":"2026-07-30T09:20:17"}`.
 * Rút `SigningTime` — thời điểm ký, đã là GIỜ ĐỊA PHƯƠNG (khác `nky`/`ncma` trả giờ UTC có hậu tố Z).
 * Không parse được (chuỗi hỏng, field vắng) -> "" để ô đi theo quy ước chung: web "—", file trống.
 */
function chuKySigningTime(v: unknown): string {
  if (typeof v !== "string" || v === "") return "";
  try {
    const parsed = JSON.parse(v) as { SigningTime?: unknown };
    return typeof parsed.SigningTime === "string" ? parsed.SigningTime : "";
  } catch {
    return ""; // GDT đổi định dạng chuỗi ký -> mất 1 ô, không được làm hỏng cả dòng
  }
}

/**
 * Biển số xe Việt Nam trong chuỗi bất kỳ — vd "Xe 29K-225.29" -> "29K-225.29".
 * Hóa đơn xăng dầu/vận tải hay ghi phương tiện vào ô "họ tên người mua" (`nmtnmua`) thay vì tên người.
 * Mẫu: 2 số tỉnh + 1-2 chữ (có thể kèm 1 số) + "-" + 3 số + (dấu chấm) + 2-3 số.
 * Không khớp -> "" (thà để trống còn hơn đổ nhầm tên người mua vào cột "Biển số xe").
 */
const BIEN_SO_XE_RE = /\b\d{2}[A-Z]{1,2}\d?-\d{3}\.?\d{2,3}\b/i;

function bienSoXe(v: string): string {
  return BIEN_SO_XE_RE.exec(v)?.[0] ?? "";
}

/**
 * Bản đồ ngược "HĐ này bị HĐ nào thay thế/điều chỉnh".
 *
 * Payload chi tiết của HĐ BỊ thay thế (tthai=4) / bị điều chỉnh (tthai=5) KHÔNG mang field nào trỏ
 * tới HĐ thay thế (toàn bộ nhóm `…goc` đều null) — liên kết MỘT CHIỀU: chỉ HĐ thay thế (tthai=2) /
 * điều chỉnh (tthai=3) biết HĐ gốc, qua `khhdgoc`/`shdgoc`. Nên phải dựng ở cấp lô rồi truyền vào
 * `toDetailRows`/`toDisplayRow`.
 *
 * NGUỒN PHẢI VƯỢT RA NGOÀI KHOẢNG ĐANG XEM: HĐ thay thế thường lập ở KỲ SAU HĐ gốc, dựng bản đồ từ
 * chính lô đang lọc là lọc theo tháng sẽ tra không ra (đo trên dữ liệu thật: 16/26 cặp khác tháng).
 * Vì vậy nơi gọi truyền vào danh sách `thayThe` do BE trả riêng (`readReplacements`), KHÔNG phải
 * `datas`/`details` của khoảng.
 *
 * Key: `${nbmst}|${khhdon}|${shdon}` của HĐ GỐC — cùng người bán (chỉ NB tự thay thế HĐ của mình),
 * thêm `nbmst` để khỏi nhầm khi một lô MUA VÀO gom HĐ của nhiều NB khác nhau.
 * Value: số + ngày lập + loại (`tthai`) của HĐ thay thế/điều chỉnh.
 */
export type ReplacedByMap = Map<string, { soHd: string; ngay: string; tthai: string }>;

export function buildReplacedByMap(
  details: (Record<string, unknown> | null | undefined)[],
): ReplacedByMap {
  const m: ReplacedByMap = new Map();
  for (const d of details) {
    if (!d) continue;
    const tthai = s(d.tthai);
    if (tthai !== "2" && tthai !== "3") continue;
    const kyHieuGoc = s(d.khhdgoc);
    const soHdGoc = s(d.shdgoc);
    if (!kyHieuGoc || !soHdGoc) continue;
    m.set(`${s(d.nbmst)}|${kyHieuGoc}|${soHdGoc}`, {
      soHd: s(d.shdon),
      ngay: s(d.tdlap),
      tthai,
    });
  }
  return m;
}

/**
 * Nội dung cột "Ghi chú: Hóa đơn thay thế, điều chỉnh, bị thay thế, bị điều chỉnh" — 2 hướng liên kết:
 *
 * - HĐ này THAY THẾ (tthai=2) / ĐIỀU CHỈNH (tthai=3) HĐ khác: nhóm `…goc` của chính nó có dữ liệu
 *   -> "Thay thế cho hóa đơn 1796 ngày 20-05-2026".
 * - HĐ này BỊ THAY THẾ (tthai=4) / BỊ ĐIỀU CHỈNH (tthai=5): payload bản thân nó KHÔNG biết HĐ kia,
 *   phải tra `replacedBy` (dựng từ các HĐ tthai 2/3 trong cùng lô) theo khóa của chính nó
 *   -> "Bị thay thế bởi hóa đơn 1772 ngày 19-05-2026". Không tra được (thiếu HĐ thay thế trong lô) -> "".
 *
 * Bỏ field `gchdgoc` (ghi chú dài của NB, vd "Hóa đơn thay thế cho hóa đơn điện tử mẫu 1 ký hiệu
 * C26TLT số 1796 lập ngày…") — thừa; số + ngày gốc là đủ cho kế toán định danh. Ngày gốc định dạng
 * `dd-MM-yyyy` (dấu `-`) để phân biệt với các mặt phân tách khác. Hóa đơn mới (tthai=1) -> "".
 *
 * Export để bảng TỔNG QUÁT dùng lại y hệt (xem `toDisplayRow`): ở đó tham số `detail` là 1 dòng
 * danh sách đã lưu — cùng bộ field vì BE trích sẵn nhóm `…goc` từ JSON chi tiết.
 */
export function tinhGhiChuLienQuan(
  detail: Record<string, unknown>,
  replacedBy?: ReplacedByMap,
): string {
  const tthai = s(detail.tthai);
  if (tthai === "2" || tthai === "3") {
    const soHd = s(detail.shdgoc);
    const ngay = s(detail.tdlhdgoc);
    if (!soHd && !ngay) return "";
    const dongTu = tthai === "3" ? "Điều chỉnh" : "Thay thế";
    const ngayFmt = ngay ? formatDateVN(ngay).replace(/\//g, "-") : "";
    return [`${dongTu} cho hóa đơn`, soHd, ngayFmt ? `ngày ${ngayFmt}` : ""]
      .filter(Boolean)
      .join(" ");
  }
  if (tthai === "4" || tthai === "5") {
    const key = `${s(detail.nbmst)}|${s(detail.khhdon)}|${s(detail.shdon)}`;
    const r = replacedBy?.get(key);
    if (!r) return "";
    const dongTu = tthai === "5" ? "Bị điều chỉnh" : "Bị thay thế";
    const ngayFmt = r.ngay ? formatDateVN(r.ngay).replace(/\//g, "-") : "";
    return [`${dongTu} bởi hóa đơn`, r.soHd, ngayFmt ? `ngày ${ngayFmt}` : ""]
      .filter(Boolean)
      .join(" ");
  }
  return "";
}


export function toDetailRows(
  detail: Record<string, unknown> | null | undefined,
  stt = 0,
  replacedBy?: ReplacedByMap,
): DetailRow[] {
  if (!detail) return [];

  // Tra cứu hóa đơn gốc theo NCC phát hành (registry keyed bằng `msttcgp`, xem traCuuNcc.ts).
  // Tính 1 lần cho cả hóa đơn: `urlTraCuu` = link trang tra cứu của NCC, `dliu` = mã tra cứu trích
  // đúng field của NCC đó. NCC chưa có trong registry -> cả hai rỗng.
  const traCuu = traCuuNcc(detail);

  // Thông tin hóa đơn — lặp mỗi dòng hàng.
  const header = {
    // Số thứ tự của HÓA ĐƠN (do nơi gọi tra từ bảng Tổng quát), lặp y hệt ở mọi dòng hàng.
    stt,
    mauHd: s(detail.khmshdon),
    kyHieu: s(detail.khhdon),
    soHd: s(detail.shdon),
    ngayHd: s(detail.tdlap),
    ngayKy: s(pick(detail, "nky", "tgian", "ntao")),
    sellerMst: s(detail.nbmst),
    sellerTen: s(detail.nbten),
    sellerDiaChi: s(detail.nbdchi),
    buyerMst: s(detail.nmmst),
    // Bán lẻ/cá nhân: `nmten` (tên đơn vị) rỗng, họ tên người mua nằm ở `nmtnmua`.
    buyerTen: s(pick(detail, "nmten", "nmtnmua", "nmnmua")),
    buyerDiaChi: s(detail.nmdchi),
    // Cùng danh sách key ứng viên với `toInvoiceView.maCqt` — hai nơi đọc cùng một thứ.
    mccqt: s(pick(detail, "mhso", "mcqt", "macqt", "mhdon")),
    // Ưu tiên `SigningTime` trong chữ ký số của Cục Thuế (`cqtcks`) — đây đúng là "CQT ký số";
    // `ncma` (ngày cấp mã) là mốc gần như trùng, dùng bù khi hóa đơn không kèm khối chữ ký.
    ngayCqtKy: chuKySigningTime(detail.cqtcks) || s(detail.ncma),
    ghiChu: s(detail.gchu),
    websiteNb: s(detail.nbwebsite),
    // MST nhà cung cấp phát hành — khóa ghép với registry `TRA_CUU_NCC`.
    msttcgp: s(detail.msttcgp),
    urlTraCuu: traCuu?.url ?? "",
    dliu: traCuu?.maTraCuu ?? "",
    tvan: s(detail.ngcnhat),
    // `nmtnmua` = họ tên người mua hàng; hóa đơn xăng dầu/vận tải ghi biển số xe vào đây.
    bienSoXe: bienSoXe(s(detail.nmtnmua)),
    ghiChuLienQuan: tinhGhiChuLienQuan(detail, replacedBy),
    maNt: s(detail.dvtte),
    tyGia: num(detail.tgia),
    tongTienHang: num(detail.tgtcthue),
    tongThue: num(detail.tgtthue),
    tongCk: num(detail.ttcktmai),
    // Không như các cột tiền khác (thiếu -> ô trống): GDT để `tgtphi` null cho hóa đơn không có khoản
    // phí nào, mà "không có phí" nghĩa là 0 đồng chứ không phải "chưa biết" -> hiện 0 cho cả bảng web
    // lẫn sheet Excel (còn cộng được cả cột).
    tongPhi: num(detail.tgtphi) ?? 0,
    tongTt: num(detail.tgtttbso),
    // Cột "Thuế" và "Tiền sau thuế" — cấp hóa đơn, cùng nguồn với "Tổng tiền thuế"/"Tổng thanh toán".
    thue: num(detail.tgtthue),
    tienSauThue: num(detail.tgtttbso),
    hinhThucTt: s(detail.thtttoan),
    trangThaiHd: s(detail.tthai),
    ketQuaKt: s(detail.ttxly),
  };

  const items = Array.isArray(detail.hdhhdvu) ? detail.hdhhdvu : [];
  // Hóa đơn không có dòng hàng vẫn ra ĐÚNG 1 hàng, và hàng đó là hàng đầu của hóa đơn -> phải bật
  // `isFirstRow`, nếu không các cột "chỉ hiện ở dòng đầu" (tổng tiền, mã tra cứu) sẽ trống hết.
  if (items.length === 0) return [{ ...header, ...EMPTY_LINE, isFirstRow: true }];

  // Dựng MỘT LẦN cho cả hóa đơn, không dựng lại ở từng dòng hàng.
  const rateByLabel = taxRateByLabel(detail);

  return items.map((raw, idx) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    const tienChuaThue = num(pick(it, "thtien", "thanhtien"));
    const thueSuat = s(pick(it, "ltsuat", "tsuat", "thuesuat"));
    /**
     * Tiền thuế THEO DÒNG, ba nguồn xếp theo độ tin cậy giảm dần:
     *  1. `tthue` của chính dòng hàng — chuẩn nhất, nhưng GDT gần như luôn để trống;
     *  2. hệ số suy từ `thttltsuat` của hóa đơn — xử lý được cả mức "KKKNT"/"KCT" (hệ số 0);
     *  3. con số trong chuỗi thuế suất ("10%" -> 0.1) — chốt chặn khi hóa đơn không có bảng tổng hợp.
     * Không nguồn nào cho kết quả -> hệ số 0, tức KHÔNG có thuế: năm cột tiền thuế/sau thuế phải
     * luôn ra một con số (0 chứ không phải ô trống) theo yêu cầu của kế toán.
     *
     * KHÔNG làm tròn kết quả, chỉ dọn rác dấu phẩy động — số lẻ ở đây là số liệu thật của hóa đơn.
     * Đổi lại, ở nhánh (3) tổng cột có thể lệch vài đồng so với `tgtthue` do người bán đã làm tròn
     * khi phát hành; nhánh (2) thì không lệch vì hệ số lấy từ chính số tiền của hóa đơn.
     */
    const rate = rateByLabel.get(thueSuat) ?? thueSuatRate(thueSuat) ?? 0;
    const thueDong =
      num(pick(it, "tthue", "thue")) ?? stripFloatNoise((tienChuaThue ?? 0) * rate);
    return {
      ...header,
      maVt: s(pick(it, "ma", "mhhdvu", "mahang")),
      tenHang: s(pick(it, "ten", "thang")),
      dvt: s(pick(it, "dvtinh", "dvt")),
      soLuong: num(pick(it, "sluong", "soluong")),
      gia: num(pick(it, "dgia", "dongia")),
      tienCk: num(pick(it, "stckhau", "tienck")),
      tienChuaThue,
      // Không có chiết khấu nghĩa là chiết khấu 0%, không phải "chưa biết" -> 0 thay vì ô trống.
      tlCktm: num(pick(it, "tlckhau", "tlck")) ?? 0,
      thueSuat,
      tinhChat: s(pick(it, "tchat", "tinhchat")),
      thueDong,
      tienSauThueDong: stripFloatNoise((tienChuaThue ?? 0) + thueDong),
      // Đánh dấu dòng đầu tiên của mỗi hóa đơn để chỉ hiển thị tổng tiền một lần
      isFirstRow: idx === 0,
    };
  });
}

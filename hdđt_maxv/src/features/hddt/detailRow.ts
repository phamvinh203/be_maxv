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
  tenHang: "",
  dvt: "",
  soLuong: undefined,
  gia: undefined,
  tienCk: undefined,
  tienChuaThue: undefined,
  thue: undefined,
  tienSauThue: undefined,
  tlCktm: undefined,
  thueSuat: "",
};

/**
 * Chuyển payload chi tiết GDT (`/detail`) -> danh sách dòng bảng "Chi tiết hóa đơn".
 * Mỗi phần tử mảng hàng hóa `hdhhdvu` thành 1 dòng, lặp lại thông tin hóa đơn (header) ở mỗi dòng.
 * Hóa đơn không có dòng hàng -> vẫn trả 1 dòng chỉ gồm header (đỡ trống trơn).
 *
 * GHI CHÚ ÁNH XẠ (chỉnh Ở ĐÂY nếu tên field GDT thực tế lệch):
 *  - Header: khmshdon, khhdon, shdon, tdlap, nbmst, nbten, nmmst, nmten/nmtnmua, nmdchi, dvtte,
 *    tgia, tgtcthue, tgtthue, ttcktmai, tgtphi, tgtttbso, thtttoan, tthai, ttxly (giống field
 *    danh sách — đã dùng ổn).
 *  - Mảng hàng hóa: `hdhhdvu`. Mỗi dòng: ten, dvtinh, sluong, dgia, stckhau(tiền CK), tlckhau(%CK),
 *    thtien(tiền chưa thuế), sthue(tiền thuế dòng — có thể thiếu), tsuat/ltsuat(thuế suất).
 */
export function toDetailRows(
  detail: Record<string, unknown> | null | undefined,
): DetailRow[] {
  if (!detail) return [];

  // Thông tin hóa đơn — lặp mỗi dòng hàng.
  const header = {
    mauHd: s(detail.khmshdon),
    kyHieu: s(detail.khhdon),
    soHd: s(detail.shdon),
    ngayHd: s(detail.tdlap),
    sellerMst: s(detail.nbmst),
    sellerTen: s(detail.nbten),
    buyerMst: s(detail.nmmst),
    // Bán lẻ/cá nhân: `nmten` (tên đơn vị) rỗng, họ tên người mua nằm ở `nmtnmua`.
    buyerTen: s(pick(detail, "nmten", "nmtnmua", "nmnmua")),
    buyerDiaChi: s(detail.nmdchi),
    maNt: s(detail.dvtte),
    tyGia: num(detail.tgia),
    tongTienHang: num(detail.tgtcthue),
    tongThue: num(detail.tgtthue),
    tongCk: num(detail.ttcktmai),
    tongPhi: num(detail.tgtphi),
    tongTt: num(detail.tgtttbso),
    hinhThucTt: s(detail.thtttoan),
    trangThaiHd: s(detail.tthai),
    ketQuaKt: s(detail.ttxly),
  };

  const items = Array.isArray(detail.hdhhdvu) ? detail.hdhhdvu : [];
  if (items.length === 0) return [{ ...header, ...EMPTY_LINE }];

  return items.map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    const tienChuaThue = num(pick(it, "thtien", "thanhtien"));
    const thue = num(pick(it, "sthue", "tthue"));
    // Tiền sau thuế: ưu tiên field GDT nếu có, không thì cộng chưa thuế + thuế.
    const tienSauThue =
      num(pick(it, "thtiensauthue")) ??
      (tienChuaThue != null && thue != null ? tienChuaThue + thue : undefined);
    return {
      ...header,
      tenHang: s(pick(it, "ten", "thang")),
      dvt: s(pick(it, "dvtinh", "dvt")),
      soLuong: num(pick(it, "sluong", "soluong")),
      gia: num(pick(it, "dgia", "dongia")),
      tienCk: num(pick(it, "stckhau", "tienck")),
      tienChuaThue,
      thue,
      tienSauThue,
      tlCktm: num(pick(it, "tlckhau", "tlck")),
      thueSuat: s(pick(it, "ltsuat", "tsuat", "thuesuat")),
    };
  });
}

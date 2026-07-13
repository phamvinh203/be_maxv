import type { DisplayRow, InvoiceDirection, InvoiceRaw } from "./types";

/** Ép 1 giá trị bất kỳ (field GDT kiểu `unknown`) về string an toàn (null/undefined -> ""). */
function rowStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/**
 * Chuẩn hóa 1 hàng GDT/DB -> `DisplayRow`. Bên đối tác đã gộp sẵn ở `mstDoiTac`/`tenDoiTac`,
 * bên "mình" lấy từ field gốc còn lại (mua vào -> người mua nmmst/nmten; bán ra -> người bán
 * nbmst/nbten). Lấy trực tiếp từ hàng để hiển thị đúng kể cả khi chưa đăng nhập GDT.
 * Dùng: `InvoiceListTabs` (bảng Tổng quát), `SystemDataTab` (xuất/sao lưu).
 */
export function toDisplayRow(r: InvoiceRaw, direction: InvoiceDirection): DisplayRow {
  const isPurchase = direction === "purchase";
  const ownMst = rowStr(isPurchase ? r.nmmst : r.nbmst);
  const ownTen = rowStr(isPurchase ? r.nmten : r.nbten);
  return {
    id: r.id,
    mauHd: r.khmshdon,
    soSeri: r.khhdon,
    soHd: r.shdon,
    ngayLap: r.tdlap,
    sellerMst: isPurchase ? r.mstDoiTac : ownMst,
    sellerTen: isPurchase ? r.tenDoiTac : ownTen,
    sellerDiaChi: isPurchase ? (r.diaChiDoiTac ?? "") : "",
    buyerMst: isPurchase ? ownMst : r.mstDoiTac,
    buyerTen: isPurchase ? ownTen : r.tenDoiTac,
    tienChuaThue: r.tgtcthue,
    tienThue: r.tgtthue,
    cktm: r.ttcktmai,
    phi: r.tgtphi,
    tongTt: r.tgtttbso,
    maNt: r.dvtte ?? "",
    tyGia: r.tgia,
    trangThaiHd: r.tthai,
    ketQuaKt: r.ttxly,
  };
}

import {
  tinhGhiChuLienQuan,
  tinhNgayLienQuan,
  type ReplacedByMap,
} from "./detailRow";
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
 *
 * `replacedBy` (dựng bằng `buildReplacedByMap` từ CẢ LÔ đang xem) chỉ cần cho nhánh "hóa đơn này BỊ
 * thay thế/điều chỉnh" của cột ghi chú — bản thân hóa đơn không mang thông tin đó, phải tra ngược.
 * Bỏ trống thì cột chỉ mất nhánh ấy, các cột khác không đổi.
 */
export function toDisplayRow(
  r: InvoiceRaw,
  direction: InvoiceDirection,
  replacedBy?: ReplacedByMap,
): DisplayRow {
  const isPurchase = direction === "purchase";
  const ownMst = rowStr(isPurchase ? r.nmmst : r.nbmst);
  const ownTen = rowStr(isPurchase ? r.nmten : r.nbten);
  return {
    id: r.id,
    mauHd: r.khmshdon,
    soSeri: r.khhdon,
    soHd: r.shdon,
    ngayLap: r.tdlap,
    ngayKy: rowStr(r.nky),
    sellerMst: isPurchase ? r.mstDoiTac : ownMst,
    sellerTen: isPurchase ? r.tenDoiTac : ownTen,
    // Địa chỉ bên bán lấy thẳng `nbdchi` (BE đã trả trong SAVED_LIST_SELECT) — đúng cho cả hai chiều.
    sellerDiaChi: rowStr(r.nbdchi),
    buyerMst: isPurchase ? ownMst : r.mstDoiTac,
    // Hóa đơn bán lẻ/cá nhân: GDT để trống tên đơn vị (`nmten`), họ tên người mua nằm ở `nmtnmua`.
    // Không fallback thì cột "Tên công ty người mua" của chiều bán ra trống hàng loạt.
    buyerTen: (isPurchase ? ownTen : rowStr(r.tenDoiTac)) || rowStr(r.nmtnmua),
    // Địa chỉ bên mua lấy thẳng `nmdchi` (BE đã trả trong SAVED_LIST_SELECT) — đúng cho cả hai chiều.
    buyerDiaChi: rowStr(r.nmdchi),
    tienChuaThue: r.tgtcthue,
    tienThue: r.tgtthue,
    cktm: r.ttcktmai,
    phi: r.tgtphi,
    tongTt: r.tgtttbso,
    maNt: r.dvtte ?? "",
    tyGia: r.tgia,
    trangThaiHd: r.tthai,
    ketQuaKt: r.ttxly,
    ttTai: typeof r.tt_tai === "string" ? r.tt_tai : undefined,
    // MST NCC phát hành (vd Viettel/MISA) — keyed với `TRA_CUU_NCC`; BE trích từ raw trong SAVED_LIST.
    msttcgp: rowStr(r.msttcgp),
    // Tên mặt hàng đầu tiên + ghi chú thay thế/điều chỉnh: BE đã trích sẵn nhóm field nguồn từ JSON
    // `detail`, nên tính được ngay tại đây mà không phải tải chi tiết. Dùng CHUNG hàm với bảng Chi
    // tiết để hai bảng không thể ghi khác nhau về cùng một hóa đơn.
    tenHang: rowStr(r.tenHang),
    ghiChuLienQuan: tinhGhiChuLienQuan(r, replacedBy),
    ngayLienQuan: tinhNgayLienQuan(r, replacedBy),
  };
}

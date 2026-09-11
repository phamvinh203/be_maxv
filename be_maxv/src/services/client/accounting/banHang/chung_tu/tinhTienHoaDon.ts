/**
 * Số tiền của hóa đơn bán hàng — SERVER tính từ input thô, không nhận số client gửi (vbsec 2026-09-10,
 * MASS-ASSIGNMENT: sửa payload là ghi khống/giảm doanh thu, thuế).
 *
 * Công thức PHẢI KHỚP `fe_maxv/src/features/ban_hang/chung_tu/hoa_don_ban_hang/calc.ts` (màn hình tính
 * xem trước bằng đúng các bước này, lệch là số lưu khác số người dùng thấy lúc bấm Lưu):
 *   - Tiền (tien_nt2)          = Số lượng bán thực tế × Giá
 *   - Chiết khấu (ck_nt)       = Tiền × TLCK%
 *   - Tiền thuế (thue_nt)      = (Tiền − Chiết khấu) × Thuế suất%
 *   - Tiền khay (tien_khay_nt) = (SL2 − SL2 nhận lại) × Giá khay
 *   - Tiền tính nợ (tien_no_nt) = Tiền + Tiền khay
 *   - Tổng thanh toán          = Σ Tiền − Σ Chiết khấu + Σ Tiền thuế
 * Mọi bước làm tròn 2 chữ số như FE. Cột quy đổi (không hậu tố `_nt`) = số nguyên tệ × tỷ giá.
 *
 * Hàm thuần (không Prisma) để test được không cần DB.
 */

/** Làm tròn 2 chữ số — cùng cách `round` của FE. */
export const lamTron2 = (n: number): number => Math.round(n * 100) / 100;

/** Tổng số lượng (Decimal 18,4) — chỉ bỏ nhiễu dấu phẩy động của phép cộng. */
const lamTron4 = (n: number): number => Math.round(n * 10_000) / 10_000;

export interface DauVaoDong {
  so_luong: number;
  gia_nt2: number;
  tl_ck: number;
  thue_suat: number;
  so_luong2: number;
  so_luong2_nl: number;
  gia_khay_nt: number;
}

export interface TienDong {
  tien_nt2: number;
  ck_nt: number;
  thue_nt: number;
  tien_khay_nt: number;
  tien_no_nt: number;
  gia2: number;
  tien2: number;
  ck: number;
  thue: number;
  gia_khay: number;
  tien_khay: number;
  tien_no: number;
}

export function tinhDong(l: DauVaoDong, tyGia: number): TienDong {
  const tien_nt2 = lamTron2(l.so_luong * l.gia_nt2);
  const ck_nt = lamTron2((tien_nt2 * l.tl_ck) / 100);
  const thue_nt = lamTron2(((tien_nt2 - ck_nt) * l.thue_suat) / 100);
  const tien_khay_nt = lamTron2((l.so_luong2 - l.so_luong2_nl) * l.gia_khay_nt);
  const tien_no_nt = lamTron2(tien_nt2 + tien_khay_nt);
  const quyDoi = (nt: number) => lamTron2(nt * tyGia);
  return {
    tien_nt2,
    ck_nt,
    thue_nt,
    tien_khay_nt,
    tien_no_nt,
    gia2: quyDoi(l.gia_nt2),
    tien2: quyDoi(tien_nt2),
    ck: quyDoi(ck_nt),
    thue: quyDoi(thue_nt),
    gia_khay: quyDoi(l.gia_khay_nt),
    tien_khay: quyDoi(tien_khay_nt),
    tien_no: quyDoi(tien_no_nt),
  };
}

export interface TongHoaDon {
  t_so_luong: number;
  t_tien_nt2: number;
  t_ck_nt: number;
  t_thue_nt: number;
  t_tt_nt: number;
  t_tien2: number;
  t_ck: number;
  t_thue: number;
  t_tt: number;
}

/** Tổng toàn hóa đơn = cộng các dòng ĐÃ tính (như `computeTotals` của FE). */
export function tinhTong(
  dong: Array<{ so_luong: number } & TienDong>,
): TongHoaDon {
  const cong = (f: (d: (typeof dong)[number]) => number) =>
    dong.reduce((s, d) => s + f(d), 0);
  const t_tien_nt2 = lamTron2(cong((d) => d.tien_nt2));
  const t_ck_nt = lamTron2(cong((d) => d.ck_nt));
  const t_thue_nt = lamTron2(cong((d) => d.thue_nt));
  const t_tien2 = lamTron2(cong((d) => d.tien2));
  const t_ck = lamTron2(cong((d) => d.ck));
  const t_thue = lamTron2(cong((d) => d.thue));
  return {
    t_so_luong: lamTron4(cong((d) => d.so_luong)),
    t_tien_nt2,
    t_ck_nt,
    t_thue_nt,
    t_tt_nt: lamTron2(t_tien_nt2 - t_ck_nt + t_thue_nt),
    t_tien2,
    t_ck,
    t_thue,
    t_tt: lamTron2(t_tien2 - t_ck + t_thue),
  };
}

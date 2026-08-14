import type { LineForm } from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/types';

export const round = (n: number): number => Math.round(n * 100) / 100;

/** Các field làm SL Giao / SL Bán thực tế tính lại (giống updateCell của maxv1). */
const QTY_TRIGGERS: (keyof LineForm)[] = [
  'so_luong2',
  'he_so2',
  'so_luong_giao',
  'so_luong_hh',
  'ty_le_hh',
];

/**
 * Áp phụ thuộc khi 1 ô số lượng đổi:
 * - SL Giao = SL2 × Hệ số 2 (khi đổi SL2/Hệ số 2, cả hai > 0)
 * - SL Bán thực tế = (hao hụt% < tỷ lệ) ? SL Giao : SL Giao×(1+tỷ lệ%) − hao hụt
 * so_luong vẫn sửa tay được (đổi trực tiếp không kích hoạt tính lại).
 */
export function applyQtyDeps(line: LineForm, key: keyof LineForm): LineForm {
  let row = line;
  if (key === 'so_luong2' || key === 'he_so2') {
    if (row.so_luong2 > 0 && row.he_so2 > 0) {
      row = { ...row, so_luong_giao: round(row.so_luong2 * row.he_so2) };
    }
  }
  if (QTY_TRIGGERS.includes(key)) {
    const sg = row.so_luong_giao || 0;
    if (sg > 0) {
      const slhh = row.so_luong_hh || 0;
      const tlhh = row.ty_le_hh || 0;
      const so_luong =
        (slhh * 100) / sg < tlhh ? sg : round(sg * (1 + tlhh * 0.01) - slhh);
      row = { ...row, so_luong };
    }
  }
  return row;
}

/**
 * Các giá trị tính tự động của 1 dòng (read-only). so_luong (Bán thực tế) là ô
 * NHẬP trực tiếp (giống maxv1), không tự tính từ SL Giao/hao hụt/tỷ lệ.
 * - tien_nt2 (Tiền)        = Bán thực tế × Giá
 * - ck_nt (Chiết khấu)     = Tiền × TLCK%
 * - thue_nt (Tiền thuế)    = (Tiền − Chiết khấu) × thuế suất% (theo Mã thuế)
 * - tien_khay_nt (Tiền Khay) = (SL2 − SL2 nhận lại) × Giá khay
 * - tien_no_nt (Tiền tính nợ) = Tiền + Tiền Khay
 */
export function computeLine(l: LineForm): {
  tien_nt2: number;
  ck_nt: number;
  thue_nt: number;
  tien_khay_nt: number;
  tien_no_nt: number;
} {
  const tien_nt2 = round(l.so_luong * l.gia_nt2);
  const ck_nt = round((tien_nt2 * l.tl_ck) / 100);
  const thue_nt = round(((tien_nt2 - ck_nt) * l.thue_suat) / 100);
  const tien_khay_nt = round((l.so_luong2 - l.so_luong2_nl) * l.gia_khay_nt);
  const tien_no_nt = round(tien_nt2 + tien_khay_nt);
  return { tien_nt2, ck_nt, thue_nt, tien_khay_nt, tien_no_nt };
}

/** Tổng cộng toàn hóa đơn (cộng mọi dòng, giống maxv1). */
export function computeTotals(lines: LineForm[]): {
  sl: number;
  tien: number;
  ck: number;
  thue: number;
  tt: number;
} {
  let sl = 0,
    tien = 0,
    ck = 0,
    thue = 0;
  for (const l of lines) {
    const c = computeLine(l);
    sl += l.so_luong;
    tien += c.tien_nt2;
    ck += c.ck_nt;
    thue += c.thue_nt;
  }
  return { sl, tien, ck, thue, tt: tien - ck + thue };
}

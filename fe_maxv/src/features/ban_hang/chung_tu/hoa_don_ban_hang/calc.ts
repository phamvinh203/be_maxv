import type { LineForm } from '@/features/ban_hang/chung_tu/hoa_don_ban_hang/types';

export const round = (n: number): number => Math.round(n * 100) / 100;
export const fmt = (n: number): string => n.toLocaleString('vi-VN');

/** Tiền hàng = SL bán TT × Giá; Chiết khấu = Tiền × %CK (tự tính, read-only). */
export function computeLine(l: LineForm): { tien_nt2: number; ck_nt: number } {
  const tien_nt2 = round(l.so_luong * l.gia_nt2);
  const ck_nt = round((tien_nt2 * l.tl_ck) / 100);
  return { tien_nt2, ck_nt };
}

/** Tổng cộng toàn hóa đơn (bỏ qua dòng chưa nhập mã hàng). Tiền thuế nhập tay. */
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
    if (!l.ma_vt.trim()) continue;
    const c = computeLine(l);
    sl += l.so_luong;
    tien += c.tien_nt2;
    ck += c.ck_nt;
    thue += l.thue_nt;
  }
  return { sl, tien, ck, thue, tt: tien - ck + thue };
}

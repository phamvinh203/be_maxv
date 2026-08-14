/** Tiện ích format hiển thị dùng chung (số/tiền kiểu VN). */

/** Số có phân cách ngàn kiểu VN, hiển thị cả 0 (VD 24250000 -> "24.250.000"). */
export const fmt = (n: number): string => n.toLocaleString('vi-VN');

const moneyFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 });

/**
 * Tiền kiểu VN: phân cách ngàn (250000 -> "250.000"), tối đa 4 số lẻ.
 * Trả rỗng khi 0/NaN để ô không hiện số 0 thừa (giống maxv1).
 */
export const fmtMoney = (n: number | string | null | undefined): string => {
  const v = typeof n === 'string' ? Number(n) : n;
  if (!v || Number.isNaN(v)) return '';
  return moneyFormatter.format(v);
};

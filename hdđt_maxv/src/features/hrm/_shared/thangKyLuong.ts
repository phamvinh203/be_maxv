/**
 * Tháng/năm và kỳ lương — hàm THUẦN dùng chung cho Dashboard, góc chọn kỳ trên thanh HRM và
 * `PayrollPeriodProvider`. Một mô hình tháng duy nhất: kỳ lương là "tháng X/năm Y" (mã `YYYY-MM`).
 */

import type { PayrollPeriodApiItem } from "../api/du_lieu_tinh_luong/payrollPeriodsApi";

export interface ThangNam {
  nam: number;
  /** 1–12 */
  thang: number;
}

/** `YYYY-MM-DD` (hoặc ISO đầy đủ) → tháng của ngày đó. */
export function thangCua(iso: string): ThangNam {
  const [nam, thang] = iso.split("-").map(Number);
  return { nam: nam ?? 0, thang: thang ?? 0 };
}

/** Lùi `soThang` tháng (âm là tiến). */
export function luiThang({ nam, thang }: ThangNam, soThang = 1): ThangNam {
  const tong = nam * 12 + (thang - 1) - soThang;
  return { nam: Math.floor(tong / 12), thang: (tong % 12) + 1 };
}

export function soThuTuThang({ nam, thang }: ThangNam): number {
  return nam * 12 + thang;
}

export function thangCuaKy(ky: PayrollPeriodApiItem): ThangNam {
  return { nam: ky.year, thang: ky.month };
}

export function nhanThang({ nam, thang }: ThangNam): string {
  return `T${thang}/${nam}`;
}

export function kyCuaThang(
  periods: PayrollPeriodApiItem[],
  { nam, thang }: ThangNam,
): PayrollPeriodApiItem | null {
  return periods.find((p) => p.year === nam && p.month === thang) ?? null;
}

/** Kỳ của tháng muộn nhất — không dựa vào thứ tự BE trả về. */
export function kyMoiNhat(periods: PayrollPeriodApiItem[]): PayrollPeriodApiItem | null {
  let moiNhat: PayrollPeriodApiItem | null = null;
  for (const p of periods) {
    if (!moiNhat || soThuTuThang(thangCuaKy(p)) > soThuTuThang(thangCuaKy(moiNhat))) moiNhat = p;
  }
  return moiNhat;
}

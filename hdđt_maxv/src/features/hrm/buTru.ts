/** Tính toán của màn Các khoản ứng - bù trừ — thuần, không phụ thuộc React. */

import type { DongBuTru, KhoanBuTru } from "./types";

/** Id của một dòng bù trừ — chỉ cần duy nhất trong phiên. */
export function sinhIdDongBuTru(): string {
  return `DB${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function dongBuTruRong(): DongBuTru {
  return { id: sinhIdDongBuTru(), ma_bt: "", so_tien: 0 };
}

/**
 * Số tiền có dấu của một dòng: dương là trừ vào lương, âm là bù thêm.
 *
 * Số nhập vào luôn dương — bắt người dùng gõ số âm cho khoản bù là cách chắc
 * chắn sẽ có người quên dấu và trừ nhầm thành cộng.
 */
export function tienCoDau(dong: DongBuTru, khoan: KhoanBuTru | undefined): number {
  if (!khoan) return 0;
  return khoan.chieu === "bu" ? -dong.so_tien : dong.so_tien;
}

/** Tổng bị trừ của cả bảng. Âm nghĩa là kỳ này nhân viên được nhận thêm. */
export function tongBiTru(dong: DongBuTru[], khoanTheoMa: Map<string, KhoanBuTru>): number {
  return dong.reduce((tong, d) => tong + tienCoDau(d, khoanTheoMa.get(d.ma_bt)), 0);
}

/** Tổng riêng một chiều — hai chip tóm tắt trên đầu bảng. */
export function tongTheoChieu(
  dong: DongBuTru[],
  khoanTheoMa: Map<string, KhoanBuTru>,
  chieu: KhoanBuTru["chieu"],
): number {
  return dong.reduce(
    (tong, d) => (khoanTheoMa.get(d.ma_bt)?.chieu === chieu ? tong + d.so_tien : tong),
    0,
  );
}

/** Bản sao của một bảng dòng, id sinh lại. Xem ghi chú ở `kpi.nhanBanDongKpi`. */
export function nhanBanDongBuTru(dong: DongBuTru[]): DongBuTru[] {
  return dong.map((d) => ({ ...d, id: sinhIdDongBuTru() }));
}

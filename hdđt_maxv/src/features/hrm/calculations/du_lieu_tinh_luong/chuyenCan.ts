/** Tính toán của màn Lương chuyên cần — thuần, không phụ thuộc React. */

import { homNay } from "../../_shared/format";
import type { DongChuyenCan } from "../../types";

/** Id của một dòng chuyên cần — chỉ cần duy nhất trong phiên. */
export function sinhIdDongChuyenCan(): string {
  return `DC${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Dòng rỗng — ngày mặc định là hôm nay, đỡ phải mở lịch chọn cho mọi dòng. */
export function dongChuyenCanRong(): DongChuyenCan {
  return { id: sinhIdDongChuyenCan(), ma_cc: "", so_gio: 0, ngay: homNay() };
}

/** Tổng số giờ trễ/nghỉ — chip tóm tắt trên đầu bảng. */
export function tongGioChuyenCan(dong: DongChuyenCan[]): number {
  return Math.round(dong.reduce((tong, d) => tong + d.so_gio, 0) * 10) / 10;
}

/** Bản sao của một bảng dòng, id sinh lại. Xem ghi chú ở `kpi.nhanBanDongKpi`. */
export function nhanBanDongChuyenCan(dong: DongChuyenCan[]): DongChuyenCan[] {
  return dong.map((d) => ({ ...d, id: sinhIdDongChuyenCan() }));
}

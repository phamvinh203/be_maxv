/** Tính toán của màn Lương chuyên cần — thuần, không phụ thuộc React. */

import { homNay } from "./format";
import type { DongChuyenCan, LoaiChuyenCan } from "./types";

/** Id của một dòng chuyên cần — chỉ cần duy nhất trong phiên. */
export function sinhIdDongChuyenCan(): string {
  return `DC${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Dòng rỗng — ngày mặc định là hôm nay, đỡ phải mở lịch chọn cho mọi dòng. */
export function dongChuyenCanRong(): DongChuyenCan {
  return { id: sinhIdDongChuyenCan(), ma_cc: "", so_gio: 0, ngay: homNay() };
}

/**
 * Tiền bị trừ của một dòng.
 *
 * Cần biết đơn giá vì loại `mat_toan_bo` trừ đúng bằng khoản chuyên cần của
 * người đó — cùng một lỗi nhưng người hưởng 500.000 và người hưởng 300.000 mất
 * số tiền khác nhau.
 */
export function tienTruDong(
  dong: DongChuyenCan,
  loai: LoaiChuyenCan | undefined,
  donGia: number,
): number {
  if (!loai) return 0;
  switch (loai.cach_tru) {
    case "theo_gio":
      return Math.round(loai.muc_tru * dong.so_gio);
    case "theo_lan":
      return Math.round(loai.muc_tru);
    case "mat_toan_bo":
      return donGia;
    default:
      return 0;
  }
}

/** Tổng tiền bị trừ của cả bảng, đã chặn trần ở đúng mức chuyên cần. */
export function tongTruChuyenCan(
  dong: DongChuyenCan[],
  loaiTheoMa: Map<string, LoaiChuyenCan>,
  donGia: number,
): number {
  const tong = dong.reduce(
    (cong, d) => cong + tienTruDong(d, loaiTheoMa.get(d.ma_cc), donGia),
    0,
  );
  // Trừ quá mức được hưởng thì thành âm — chuyên cần chỉ mất hết là cùng, không
  // được phép ăn lấn sang các khoản lương khác.
  return Math.min(tong, donGia);
}

/** Còn lại sau khi trừ. Không xuống dưới 0. */
export function thanhTienChuyenCan(donGia: number, tongTru: number): number {
  return Math.max(0, donGia - tongTru);
}

/** Tổng số giờ trễ/nghỉ — chip tóm tắt trên đầu bảng. */
export function tongGioChuyenCan(dong: DongChuyenCan[]): number {
  return Math.round(dong.reduce((tong, d) => tong + d.so_gio, 0) * 10) / 10;
}

/** Bản sao của một bảng dòng, id sinh lại. Xem ghi chú ở `kpi.nhanBanDongKpi`. */
export function nhanBanDongChuyenCan(dong: DongChuyenCan[]): DongChuyenCan[] {
  return dong.map((d) => ({ ...d, id: sinhIdDongChuyenCan() }));
}

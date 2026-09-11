/** Hàm hiển thị riêng của Dashboard — thuần, chỉ đổi cách trình bày con số đã có. */

import type { ThangNam } from "../../_shared/thangKyLuong";
import { tienVn } from "../../_shared/format";

export function soVn(so: number, soLe = 1): string {
  return so.toLocaleString("vi-VN", { maximumFractionDigits: soLe });
}

/** `1_250_000_000` → `1,25 tỷ` · `245_300_000` → `245,3 tr` · `850_000` → `850 nghìn`. */
export function tienGon(so: number): string {
  const tuyetDoi = Math.abs(so);
  if (tuyetDoi >= 1e9) return `${soVn(so / 1e9, 2)} tỷ`;
  if (tuyetDoi >= 1e6) return `${soVn(so / 1e6, 1)} tr`;
  if (tuyetDoi >= 1e3) return `${soVn(so / 1e3, 0)} nghìn`;
  return soVn(so, 0);
}

/** Số tiền đủ từng đồng — cho tooltip, nơi người đọc cần con số chính xác. */
export function tienDayDu(so: number): string {
  return `${tienVn(Math.round(so))} ₫`;
}

/** `12.5` → `12,5 giờ` (kèm đơn vị — khác `gioVn` của khu Tăng ca chỉ trả con số). */
export function soGio(so: number): string {
  return `${soVn(so, 1)} giờ`;
}

export function phanTram(phan: number, tong: number): string {
  if (tong <= 0) return "0%";
  return `${soVn((phan / tong) * 100, 1)}%`;
}

/** Nhãn trục X cho một tháng: `T9`, dòng năm chỉ ở cột đầu và khi sang năm mới. */
export function nhanCotThang(t: ThangNam, viTri: number) {
  return {
    khoa: `${t.nam}-${t.thang}`,
    nhan: `T${t.thang}`,
    nhanPhu: viTri === 0 || t.thang === 1 ? String(t.nam) : undefined,
  };
}

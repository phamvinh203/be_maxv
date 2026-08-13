/** Tính toán của màn Tăng ca — thuần, không phụ thuộc React. */

import { moTaLoaiTangCa } from "./constants";
import type { CauHinhMacDinh, DongTangCa, LoaiTangCa } from "./types";

/** Làm tròn tới một chữ số thập phân — giờ công hay lẻ nửa tiếng. */
function lamTron(so: number): number {
  return Math.round(so * 10) / 10;
}

/** Id của một dòng tăng ca — chỉ cần duy nhất trong phiên. */
export function sinhIdDongTangCa(): string {
  return `DO${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function dongTangCaRong(): DongTangCa {
  return { id: sinhIdDongTangCa(), loai: "", so_gio: 0 };
}

/**
 * Hệ số của một loại tăng ca (%), đọc từ Cấu hình mặc định.
 *
 * Dòng chưa chọn loại trả 0 — quy đổi ra 0 giờ, đúng với nghĩa "chưa khai xong".
 */
export function heSoTangCa(cauHinh: CauHinhMacDinh, loai: LoaiTangCa | ""): number {
  if (!loai) return 0;
  return cauHinh[moTaLoaiTangCa(loai).truong];
}

/**
 * Giờ quy đổi của một dòng: số giờ OT nhân hệ số.
 *
 * 10 giờ làm ngày thường (150%) quy ra 15 giờ công — đây mới là con số bảng
 * lương dùng để nhân đơn giá, còn "Số giờ OT" là giờ người đó thực sự ngồi làm.
 */
export function gioQuyDoi(dong: DongTangCa, cauHinh: CauHinhMacDinh): number {
  return lamTron((dong.so_gio * heSoTangCa(cauHinh, dong.loai)) / 100);
}

export function tongGioOt(dong: DongTangCa[]): number {
  return lamTron(dong.reduce((tong, d) => tong + d.so_gio, 0));
}

export function tongGioQuyDoi(dong: DongTangCa[], cauHinh: CauHinhMacDinh): number {
  return lamTron(dong.reduce((tong, d) => tong + gioQuyDoi(d, cauHinh), 0));
}

/** `12.5` → `12,5` — số giờ hay lẻ, dấu phẩy thập phân theo lối Việt. */
export function gioVn(so: number): string {
  return so.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

/**
 * Màu cảnh báo cho số giờ so với một ngưỡng: quá ngưỡng thì đỏ, từ 80% ngưỡng
 * trở lên thì cam.
 *
 * Giờ tăng ca có trần theo luật, vượt là doanh nghiệp bị phạt — hiện số suông
 * thì người làm lương phải tự nhớ trần là bao nhiêu ở từng dòng.
 */
export function mauGioTangCa(so: number, nguong: number): "success" | "warning" | "error" {
  if (nguong <= 0) return "success";
  if (so > nguong) return "error";
  if (so >= nguong * 0.8) return "warning";
  return "success";
}

/** Bản sao của một bảng dòng, id sinh lại. Xem ghi chú ở `kpi.nhanBanDongKpi`. */
export function nhanBanDongTangCa(dong: DongTangCa[]): DongTangCa[] {
  return dong.map((d) => ({ ...d, id: sinhIdDongTangCa() }));
}

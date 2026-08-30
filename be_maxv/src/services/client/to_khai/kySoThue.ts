/**
 * Quy đổi kỳ kê khai <-> khoảng ngày. Dùng tại `keKhaiKy.service.ts` (quét hóa đơn thuộc kỳ) và
 * controller (kiểm tham số trước khi chạm DB).
 *
 * Test: `src/__tests__/kySoThue.test.ts`.
 */

export type KyLoai = "thang" | "quy";

export interface Ky {
  nam: number;
  kyLoai: KyLoai;
  kySo: number;
}

/** Số kỳ tối đa theo loại — 12 tháng hoặc 4 quý. */
function soKyToiDa(kyLoai: KyLoai): number {
  return kyLoai === "thang" ? 12 : 4;
}

export function kyHopLe(ky: Ky): boolean {
  if (!Number.isInteger(ky.nam) || ky.nam < 2000 || ky.nam > 2999) return false;
  if (ky.kyLoai !== "thang" && ky.kyLoai !== "quy") return false;
  return Number.isInteger(ky.kySo) && ky.kySo >= 1 && ky.kySo <= soKyToiDa(ky.kyLoai);
}

/** `2026-07-01` — định dạng ngày mà `getSavedInvoices` nhận trong query. */
function isoNgay(nam: number, thang1Based: number, ngay: number): string {
  const mm = String(thang1Based).padStart(2, "0");
  const dd = String(ngay).padStart(2, "0");
  return `${nam}-${mm}-${dd}`;
}

/**
 * Khoảng ngày của kỳ, dạng chuỗi `yyyy-MM-dd`.
 *
 * Ngày cuối kỳ tính bằng `Date.UTC(nam, thangSau, 0)` — day = 0 của tháng kế tiếp chính là ngày
 * cuối cùng của tháng hiện tại, nên năm nhuận tự đúng mà không cần bảng số ngày.
 */
export function khoangCuaKy(ky: Ky): { tuNgay: string; denNgay: string } {
  const thangDau = ky.kyLoai === "thang" ? ky.kySo : (ky.kySo - 1) * 3 + 1;
  const soThang = ky.kyLoai === "thang" ? 1 : 3;
  const ngayCuoi = new Date(Date.UTC(ky.nam, thangDau - 1 + soThang, 0));
  return {
    tuNgay: isoNgay(ky.nam, thangDau, 1),
    denNgay: isoNgay(ky.nam, thangDau + soThang - 1, ngayCuoi.getUTCDate()),
  };
}

/** "T7/2026" | "Q3/2026" — dùng trong câu thông báo trả về FE. */
export function nhanKy(ky: Ky): string {
  return `${ky.kyLoai === "thang" ? "T" : "Q"}${ky.kySo}/${ky.nam}`;
}

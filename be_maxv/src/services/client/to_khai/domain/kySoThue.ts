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

/**
 * Kỳ liền trước, cùng loại kỳ. Dùng để nối chỉ tiêu [22] "thuế còn được khấu trừ kỳ trước chuyển
 * sang" = [43] của kỳ liền trước (chốt hay nháp đều lấy — xem `layCt22KyTruoc`).
 *
 * Kỳ đầu năm lùi về kỳ CUỐI của năm trước (T1 -> T12 năm trước, Q1 -> Q4 năm trước) — quên nhánh
 * này thì số khấu trừ chuyển kỳ đứt đoạn đúng chỗ giao năm.
 */
export function kyLienTruoc(ky: Ky): Ky {
  if (ky.kySo > 1) return { ...ky, kySo: ky.kySo - 1 };
  return { nam: ky.nam - 1, kyLoai: ky.kyLoai, kySo: soKyToiDa(ky.kyLoai) };
}

/**
 * Mốc thời gian của kỳ, quy về "số thứ tự tháng" để SO ĐƯỢC giữa kỳ tháng và kỳ quý.
 *
 * Cần vì công ty được đổi kỳ khai (quý -> tháng khi doanh thu vượt ngưỡng, hoặc ngược lại), và khi
 * đó `kyLienTruoc` cùng loại không tồn tại — xem `layCt22KyTruoc`.
 *
 * `thangKetThuc(Q4/2025) === thangKetThuc(T12/2025)`: đúng, cả hai cùng kết thúc 31/12/2025.
 */
function thangBatDau(ky: Ky): number {
  return ky.nam * 12 + (ky.kyLoai === "thang" ? ky.kySo : (ky.kySo - 1) * 3 + 1);
}

export function thangKetThuc(ky: Ky): number {
  return ky.nam * 12 + (ky.kyLoai === "thang" ? ky.kySo : ky.kySo * 3);
}

/**
 * Kỳ `a` kết thúc TRƯỚC khi kỳ `b` bắt đầu — tức nối [43] -> [22] được mà không chồng lấn.
 *
 * Dùng `<` chứ không `<=` để chặn ca chồng lấn thật: T1/2026 kết thúc đúng tháng mà Q1/2026 bắt
 * đầu, nên T1 KHÔNG phải kỳ trước của Q1 — nó nằm TRONG Q1.
 */
export function truocKy(a: Ky, b: Ky): boolean {
  return thangKetThuc(a) < thangBatDau(b);
}

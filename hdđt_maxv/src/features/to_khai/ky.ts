import type { InvoiceDirection } from "../hddt/types";
import type { DisplayRow } from "../hddt/types";

export type KyLoai = "thang" | "quy";

export interface Ky {
  nam: number;
  kyLoai: KyLoai;
  kySo: number;
}

/** Một dòng bảng kê: hóa đơn gốc + phần thuộc về kỳ kê khai. */
export interface ToKhaiRow extends DisplayRow {
  /** Cột "Kê khai/không kê khai" — quyết định của kế toán, lưu ở `tokhai_ky_hoa_don`. */
  keKhai: boolean;
  /** Cột "Chỉ tiêu tăng giảm" — rỗng cho tới khi kế toán chọn. */
  chiTieuTangGiam: string;
  /** Cột "Năm" và "Kỳ kê khai" — lấy từ KỲ ĐANG XEM, không suy từ ngày lập hóa đơn nữa. */
  nam: string;
  kyKeKhai: string;
}

export type { InvoiceDirection };

/** "T7/2026" | "Q3/2026". */
export function nhanKy(ky: Ky): string {
  return `${ky.kyLoai === "thang" ? "T" : "Q"}${ky.kySo}/${ky.nam}`;
}

export function soKyToiDa(kyLoai: KyLoai): number {
  return kyLoai === "thang" ? 12 : 4;
}

export function kyHopLe(ky: Ky): boolean {
  if (!Number.isInteger(ky.nam) || ky.nam < 2000 || ky.nam > 2999) return false;
  if (ky.kyLoai !== "thang" && ky.kyLoai !== "quy") return false;
  return Number.isInteger(ky.kySo) && ky.kySo >= 1 && ky.kySo <= soKyToiDa(ky.kyLoai);
}

/**
 * Kỳ mặc định: THÁNG LIỀN TRƯỚC. Kỳ đang chạy thường chưa đủ hóa đơn để kê khai, mở sẵn nó chỉ
 * khiến người dùng thấy bảng thiếu rồi tưởng mất dữ liệu.
 */
export function kyMacDinh(): Ky {
  const now = new Date();
  const thangTruoc = now.getMonth(); // getMonth() 0-based -> chính là tháng trước dạng 1-based
  return thangTruoc === 0
    ? { nam: now.getFullYear() - 1, kyLoai: "thang", kySo: 12 }
    : { nam: now.getFullYear(), kyLoai: "thang", kySo: thangTruoc };
}

/**
 * Đọc kỳ từ query string của URL (`/to-khai?nam=2026&kyLoai=thang&kySo=7`) — đây là cách màn Hóa
 * đơn điện tử truyền kỳ vừa kê khai sang. Thiếu hoặc sai tham số thì lùi về kỳ mặc định thay vì
 * báo lỗi: người dùng gõ thẳng `/to-khai` vẫn phải vào được màn hình.
 */
export function kyTuQuery(params: URLSearchParams): Ky {
  const ky: Ky = {
    nam: Number(params.get("nam")),
    kyLoai: String(params.get("kyLoai")) as KyLoai,
    kySo: Number(params.get("kySo")),
  };
  return kyHopLe(ky) ? ky : kyMacDinh();
}

/** Kỳ -> query string để gắn vào đường dẫn `/to-khai`. */
export function kyToQuery(ky: Ky): string {
  return new URLSearchParams({
    nam: String(ky.nam),
    kyLoai: ky.kyLoai,
    kySo: String(ky.kySo),
  }).toString();
}

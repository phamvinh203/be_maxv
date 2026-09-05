/**
 * Đọc + kiểm biên tham số dùng chung cho mọi controller của mô-đun "Tờ khai".
 *
 * Tách khỏi `keKhaiKy.controller.ts` khi có controller thứ hai: chép sang file thứ hai là có hai
 * bản kiểm biên, rồi một bản được vá còn bản kia không — mà kiểm biên hỏng ở đây nghĩa là kỳ vô
 * nghĩa đi thẳng vào truy vấn hóa đơn.
 */

import { kyHopLe, type Ky, type KyLoai } from "../../../services/client/to_khai/domain/kySoThue";
import type { Chieu } from "../../../services/client/to_khai/domain/chieuHoaDon";

export interface KyInput {
  nam?: number | string;
  kyLoai?: string;
  kySo?: number | string;
}

/**
 * Kỳ từ body/query/params. Kỳ sai (tháng 13, quý 5, năm 1900) phải dừng TRƯỚC khi chạm DB — không
 * thì `khoangCuaKy` dựng ra khoảng ngày vô nghĩa và quét nhầm hóa đơn.
 */
export function docKy(raw: KyInput): Ky {
  const ky: Ky = {
    nam: Number(raw.nam),
    kyLoai: String(raw.kyLoai) as KyLoai,
    kySo: Number(raw.kySo),
  };
  if (!kyHopLe(ky)) {
    throw new Error("Kỳ kê khai không hợp lệ (kiểm tra lại loại kỳ, số kỳ và năm).");
  }
  return ky;
}

export function docChieu(raw: unknown): Chieu {
  const chieu = String(raw ?? "");
  if (chieu !== "purchase" && chieu !== "sold") {
    throw new Error("Chiều hóa đơn không hợp lệ (chỉ nhận purchase hoặc sold).");
  }
  return chieu;
}

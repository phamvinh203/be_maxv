import { vnDateParts } from "../../hddt/dateUtils";

/**
 * Quy tắc ĐỊNH DẠNG dùng chung cho mọi form "mẫu in" tờ khai (01/GTGT, 05/KK-TNCN…).
 *
 * Tách khỏi `mauInChung.tsx` (khối JSX dùng chung) vì `react-refresh` đòi một file chỉ export
 * component HOẶC chỉ export hàm/hằng, không lẫn lộn.
 *
 * VÌ SAO KHÔNG dùng `fmtMoney`/`formatDateTimeVN` sẵn có: đây là quy ước của MẪU IN, khác quy ước
 * bảng danh sách — xem chú thích từng hàm.
 */

/** `105000000` -> "105.000.000"; `-1446670` -> "(1.446.670)" (âm hiện ngoặc, đúng quy ước mẫu in).
 * Giữ nguyên số 0 thay vì ẩn như `fmtMoney` của bảng danh sách — mẫu in luôn hiện đủ mọi ô, ô trống
 * trên mẫu nghĩa là "không có chỉ tiêu", khác hẳn "có mà bằng 0". */
export function fmtSoTien(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  if (n === 0) return "0";
  const abs = Math.abs(n).toLocaleString("vi-VN");
  return n < 0 ? `(${abs})` : abs;
}

/** "2025-10-29" -> "Ngày 29 tháng 10 năm 2025" — dựng trên `vnDateParts` (tách chuỗi thủ công,
 * KHÔNG qua `Date`) như mọi hàm đọc "ngày trên chứng từ" khác trong app, xem `dateUtils.ts`. */
export function fmtNgayDai(iso: string | null): string {
  const p = vnDateParts(iso ?? undefined);
  return p ? `Ngày ${p.d} tháng ${p.m} năm ${p.y}` : (iso ?? "");
}

/** "2025-10-29T06:56:37" -> "29/10/2025 06:56:37" — phần ngày qua `vnDateParts` (regex chỉ neo đầu
 * chuỗi nên vẫn khớp dù có đuôi giờ), phần giờ tách riêng vì `vnDateParts` không đọc giờ.
 *
 * KHÁC `formatDateTimeVN` bên `dateUtils`: hàm kia đi qua `new Date` và bỏ mất giây — mẫu in cần
 * đúng dấu thời gian ký số nên không dùng chung được. */
export function fmtNgayGio(iso: string | null): string {
  if (!iso) return "";
  const p = vnDateParts(iso);
  if (!p) return iso;
  const gio = iso.split("T")[1];
  return gio ? `${p.d}/${p.m}/${p.y} ${gio}` : `${p.d}/${p.m}/${p.y}`;
}

/** `maChiTieu` chuyển sang `_shared/to_khai/gtgt01Layout.ts` khi màn lập tờ khai cũng cần — re-export
 * lại ở đây để mọi chỗ đang import từ file này không phải sửa. */
export { maChiTieu } from "../../_shared/to_khai/gtgt01Layout";

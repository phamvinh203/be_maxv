/**
 * Định dạng và ĐỌC LẠI số tiền trên mẫu in tờ khai.
 *
 * Hai chiều phải đi cùng nhau: đã hiện `264.208.827` cho dễ đọc thì cũng phải đọc lại được chính
 * chuỗi đó khi người dùng sửa ô. Tách riêng một bên là lỗi im lặng — `Number("264.208.827")` ra
 * `NaN`, ô coi như không nhập gì, không có thông báo nào.
 */

/**
 * `105000000` -> "105.000.000"; `-1446670` -> "(1.446.670)" (âm hiện ngoặc, đúng quy ước mẫu in).
 *
 * Giữ nguyên số 0 thay vì ẩn như `formatMoney` của bảng danh sách — mẫu in luôn hiện đủ mọi ô, ô
 * trống trên mẫu nghĩa là "không có chỉ tiêu", khác hẳn "có mà bằng 0".
 */
/** Dựng một lần: `toLocaleString` tạo formatter mới mỗi lượt gọi, mà mẫu in gọi 26 lần mỗi phím gõ. */
const FMT_VN = new Intl.NumberFormat("vi-VN");

export function fmtSoTien(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  if (n === 0) return "0";
  const abs = FMT_VN.format(Math.abs(n));
  return n < 0 ? `(${abs})` : abs;
}

/**
 * Đọc chuỗi người dùng gõ trong ô tiền -> số. `null` = ô để trống (nghĩa là xóa ghi đè, KHÁC với
 * nhập số 0).
 *
 * Nhận mọi cách gõ thực tế: `264.208.827` (dấu chấm phân cách nghìn kiểu Việt), `264208827`,
 * `1 234` (khoảng trắng), `(1.446.670)` và `-1446670` (hai cách viết số âm — ngoặc là cách mẫu in
 * hiển thị, nên người dùng sửa tại chỗ sẽ gõ lại đúng như thế).
 *
 * Chuỗi không đọc được -> `undefined`, để nơi gọi phân biệt với ô trống mà báo lỗi thay vì lặng lẽ
 * bỏ qua.
 */
export function docSoTien(chuoi: string): number | null | undefined {
  const s = chuoi.trim();
  if (s === "") return null;

  // Ngoặc bao ngoài = số âm (quy ước kế toán), phải bóc trước khi bỏ ký tự lạ.
  const trongNgoac = /^\((.*)\)$/.exec(s);
  const am = trongNgoac !== null || s.startsWith("-");
  const loi = (trongNgoac ? trongNgoac[1] : s).replace(/^-/, "");

  // Bỏ dấu chấm và khoảng trắng phân cách nghìn. KHÔNG hỗ trợ phần thập phân: chỉ tiêu tờ khai là
  // số nguyên đồng, mà nhận cả dấu phẩy thập phân thì "1,5" và "1.5" thành hai nghĩa khác nhau
  // tùy người gõ — mơ hồ hơn là hữu ích.
  const so = loi.replace(/[.\s]/g, "");
  if (so === "" || !/^\d+$/.test(so)) return undefined;

  const n = Number(so);
  if (!Number.isFinite(n)) return undefined;
  return am ? -n : n;
}

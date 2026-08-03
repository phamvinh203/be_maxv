/**
 * Định dạng số tiền theo style Việt Nam (1.234.567); không phải số thì trả chuỗi rỗng.
 * KHÔNG làm tròn: 9,69 hiện đúng "9,69", không thành "9,7" — xem `MAX_FRACTION_DIGITS`.
 * Dùng chung: bảng "Tổng quát" (InvoiceListTabs) và bảng "Chi tiết hóa đơn" (InvoiceDetailPanel).
 * Dùng dấu chấm (.) làm thousand separator, không hiển thị phần thập phân.
 */
export function formatMoney(n?: number): string {
  if (typeof n !== "number") return "";
  // Làm tròn về số nguyên rồi format với dấu chấm làm thousand separator
  const rounded = Math.round(n);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Cắt SAI SỐ DẤU PHẨY ĐỘNG của phép nhân/cộng — KHÔNG phải làm tròn số liệu.
 *
 * Phân biệt cho rõ, vì hai thứ này trông giống nhau mà hậu quả trái ngược:
 *  - `240633 × 10%` trong JS ra `24063.300000000003`; mấy chữ số cuối là rác của IEEE-754, ghi
 *    thẳng vào Excel là ô hiện số lẻ vô nghĩa và cộng cả cột bị lệch;
 *  - còn `9.69` là số liệu THẬT của hóa đơn, tuyệt đối không được thành `9.7` hay `10`.
 *
 * Giữ 12 chữ số có nghĩa: đủ để dọn rác, mà mọi phần lẻ thật đều nguyên vẹn. Số nguyên (phần lớn
 * tiền VND) trả thẳng — vừa khỏi đụng vào, vừa không giới hạn 12 chữ số với hóa đơn giá trị lớn.
 */
export function stripFloatNoise(v: number): number {
  if (!Number.isFinite(v) || Number.isInteger(v)) return v;
  return Number(v.toPrecision(12));
}

/**
 * Chuỗi TOÀN CHỮ SỐ -> `number` để Excel sắp xếp/lọc đúng kiểu số (mẫu số, số hóa đơn) và căn phải
 * như mẫu của phần mềm kế toán. Giữ nguyên chuỗi khi:
 *  - có số 0 đứng đầu ("0001") — đổi sang số là mất số 0, hỏng định danh hóa đơn;
 *  - không phải toàn chữ số ("K26DAA");
 *  - vượt ngưỡng số nguyên an toàn của JS — đổi sang số sẽ sai chữ số cuối.
 * Dùng: cột "Ký hiệu mẫu số"/"Mẫu số HD" và "Số hóa đơn" của `templates/dauVao`.
 */
export function numericText(v: string): string | number {
  if (!/^[1-9]\d*$/.test(v)) return v;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : v;
}

/**
 * Quy đổi số tiền NGUYÊN TỆ sang VND theo tỷ giá của chính hóa đơn đó.
 *
 * Hóa đơn VND có `tgia` = 1 (hoặc bỏ trống) nên mặc định nhân 1 — quy đổi khi đó chính là số cũ,
 * cột "(VND)" vẫn có số thay vì trống. Tỷ giá <= 0 coi như không có (dữ liệu hỏng thì nhân vào sẽ
 * ra 0 đồng — sai nguy hiểm hơn là giữ nguyên nguyên tệ).
 * KHÔNG làm tròn kết quả — chỉ dọn rác dấu phẩy động của phép nhân (`stripFloatNoise`). Quy đổi ra
 * số lẻ thì giữ nguyên số lẻ; làm tròn về đồng là tự ý sửa số liệu hóa đơn.
 * Không có số tiền -> `undefined` theo quy ước chung: web hiện "—", file xuất để ô trống.
 * Dùng: cột "(VND)" của `templates/dauVao` và `templates/dauRa`.
 */
export function toVnd(amount?: number, tyGia?: number): number | undefined {
  if (typeof amount !== "number") return undefined;
  return stripFloatNoise(amount * (typeof tyGia === "number" && tyGia > 0 ? tyGia : 1));
}

/**
 * Nhãn cột "T. thái tải" theo `tt_tai`: "OK" -> "OK", "error" -> "Lỗi", còn lại "" (chưa tải).
 * Dùng chung: cột Tổng quát (InvoiceListTabs) và file xuất Excel (exportXlsx).
 */
export function ttTaiLabel(v?: string): string {
  return v === "OK" ? "OK" : v === "error" ? "Lỗi" : "";
}

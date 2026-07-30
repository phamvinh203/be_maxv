/**
 * Sinh mã QR của tờ hóa đơn ra SVG (chuỗi) để nhúng thẳng vào HTML.
 *
 * Bản thể hiện của cổng thuế vẽ QR bằng jQuery + canvas lúc mở file, nên `invoice.html` của họ phải
 * kèm `details.js` 110KB. Ở đây sinh SẴN thành SVG lúc dựng HTML: file .html xuất ra không cần chạy
 * JS, in ra vẫn nét (vector), và bản PDF cũng có QR — cả ba thứ đó đều không làm được nếu vẽ bằng
 * canvas lúc chạy.
 */
import qrcode from "qrcode-generator";

/**
 * Mức sửa lỗi. "M" (~15%) là mức cổng thuế và các bên phát hành hóa đơn dùng: đủ chịu nhoè khi in
 * giấy thường mà không làm mã dày thêm quá mức.
 */
const ERROR_CORRECTION = "M";

/**
 * Dựng thẻ `<svg>` chứa mã QR của `data`, hoặc chuỗi rỗng nếu không có dữ liệu / dựng lỗi.
 *
 * Kích thước hiển thị do CSS `.inv-qr svg` quyết định (`invoiceHtml.ts`) — ở đây không nhận tham số
 * kích thước để khỏi có hai nguồn cho cùng một con số, sửa chỗ này lại không thấy tác dụng.
 *
 * KHÔNG ném lỗi: thiếu mã QR thì tờ hóa đơn vẫn hợp lệ và vẫn phải xuất ra được — chặn cả lượt xuất
 * vì một ô trang trí là không đáng.
 */
export function invoiceQrSvg(data: string): string {
  if (!data) return "";
  try {
    // typeNumber 0 = tự chọn phiên bản nhỏ nhất chứa đủ dữ liệu.
    const qr = qrcode(0, ERROR_CORRECTION);
    // Bản mặc định của thư viện mã hóa mỗi ký tự thành 1 byte (`c & 0xff`), nên ký tự ngoài ASCII
    // sẽ ra byte SAI và mã quét lên thành rác — im lặng, không lỗi nào. Chuỗi DLQRCode gần như luôn
    // thuần ASCII nhưng do bên phát hành sinh, mình không kiểm soát. Đưa sẵn TỪNG BYTE UTF-8 thành
    // một ký tự ≤ 0xFF thì `c & 0xff` giữ nguyên byte, tức mã hóa UTF-8 đúng; với ASCII thì kết quả
    // không khác gì. (Biến thể `qrcode_UTF8` của thư viện không import được: exports map không mở
    // subpath.)
    qr.addData(String.fromCharCode(...new TextEncoder().encode(data)));
    qr.make();
    // KHÔNG đặt `margin: 0`: chuẩn QR đòi vùng lặng 4 module quanh mã, mà ô QR nằm ngay trên ảnh
    // nền vân của tờ hóa đơn — mã chạm sát vân nền thì máy quét mất mốc định vị, hay gặp nhất khi
    // quét ảnh chụp hóa đơn in giấy. Để thư viện dùng mặc định (cellSize × 4); nhờ `scalable` +
    // width/height ép cứng, ô QR trên tờ hóa đơn không đổi kích thước, chỉ module nhỏ lại chút.
    return qr.createSvgTag({ cellSize: 2, scalable: true }).replace("<svg", `<svg style="display:block"`);
  } catch (e) {
    console.error("[invoiceQr] Không dựng được mã QR:", e);
    return "";
  }
}

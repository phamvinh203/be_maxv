/**
 * Diễn giải RESPONSE của cổng Dịch vụ công — bóc bảng kết quả từ MẢNH HTML tra cứu, và nhận
 * diện captcha sai (dùng chung cho cả bước đăng nhập lẫn tra cứu, xem `laLoiCaptcha`).
 *
 * Trang tra cứu chạy bằng htmx nên `GET /tthc/ho-so/search` trả một mảnh HTML để nhét vào
 * `#table-container`, không phải JSON. Muốn hiện lên bảng của mình thì phải bóc ngược ra.
 *
 * Cố tình KHÔNG dùng thư viện parse HTML: mảnh này chỉ có một bảng, mà thêm `cheerio` hay
 * `jsdom` vào backend là kéo theo vài MB phụ thuộc cho đúng một việc. Bù lại bộ bóc bằng
 * regex dưới đây phải chấp nhận là mong manh trước thay đổi markup — nên nó tách hẳn khỏi
 * `gdt-dvc.service.ts`, để cổng đổi giao diện/câu chữ báo lỗi thì chỉ sửa một file.
 */

import { htmlToText } from "../hddt/traCuuGoc/shared";

/** Một bảng đã bóc: tiêu đề cột theo đúng thứ tự cổng trả, và các dòng dữ liệu. */
export interface BangHoSoDaBoc {
  /** Tiêu đề cột lấy từ `<thead>`; rỗng nếu mảnh HTML không có phần đó. */
  headers: string[];
  /** Mỗi dòng là mảng ô theo đúng thứ tự cột. */
  rows: string[][];
}

const TABLE_RE = /<table[^>]*>([\s\S]*?)<\/table>/i;
const THEAD_RE = /<thead[^>]*>([\s\S]*?)<\/thead>/i;
const TBODY_RE = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i;
const ROW_RE = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL_RE = /<(t[dh])[^>]*>([\s\S]*?)<\/\1>/gi;

/** Mọi ô của một `<tr>`, theo thứ tự xuất hiện. Nội dung ô -> văn bản thuần qua `htmlToText`
 * (bỏ `<script>`/`<style>`, gỡ thẻ, giải HTML entity một lượt — dùng chung với `hddt`, xem
 * `traCuuGoc/shared.ts`). Ô thao tác (nút tải file, xem thông báo) chỉ còn lại nhãn chữ nếu
 * có — phần hành vi của nút phải xử lý riêng, không bóc ra được bằng cách này. */
function cellsOf(rowHtml: string): string[] {
  const cells: string[] = [];
  for (const match of rowHtml.matchAll(CELL_RE)) {
    cells.push(htmlToText(match[2] ?? ""));
  }
  return cells;
}

/**
 * Bóc bảng đầu tiên trong mảnh HTML.
 *
 * Trả `headers` rỗng + `rows` rỗng khi mảnh không có bảng nào — đó là tình huống bình
 * thường (không có hồ sơ nào khớp bộ lọc), không phải lỗi, nên KHÔNG ném.
 *
 * Không có `<tbody>` thì lấy mọi `<tr>` trừ dòng đầu nếu dòng đầu toàn `<th>`: một số bảng
 * viết tiêu đề thẳng trong `<table>` mà không bọc `<thead>`.
 */
export function parseBangHoSo(html: string): BangHoSoDaBoc {
  const table = html.match(TABLE_RE)?.[1];
  if (!table) return { headers: [], rows: [] };

  const theadHtml = table.match(THEAD_RE)?.[1];
  const tbodyHtml = table.match(TBODY_RE)?.[1];

  let headers: string[] = [];
  if (theadHtml) {
    const headerRow = [...theadHtml.matchAll(ROW_RE)].pop()?.[1];
    if (headerRow) headers = cellsOf(headerRow);
  }

  const bodyHtml = tbodyHtml ?? table.replace(THEAD_RE, "");
  const bodyRowMatches = [...bodyHtml.matchAll(ROW_RE)];
  const rows = bodyRowMatches
    .map((match) => cellsOf(match[1] ?? ""))
    .filter((cells) => cells.length > 0);

  // Không có <thead> nhưng dòng đầu toàn <th> -> đó là tiêu đề, tách ra khỏi dữ liệu.
  if (headers.length === 0 && rows.length > 0 && /<th[\s>]/i.test(bodyHtml)) {
    const firstRowHtml = bodyRowMatches[0]?.[1] ?? "";
    if (!/<td[\s>]/i.test(firstRowHtml)) {
      headers = rows[0]!;
      rows.shift();
    }
  }

  // Dòng "Không có dữ liệu" của cổng là 1 ô trải hết bảng — không phải hồ sơ.
  const loc =
    headers.length > 0 ? rows.filter((cells) => cells.length >= headers.length) : rows;

  return { headers, rows: loc };
}

/** Cổng báo captcha sai bằng câu tiếng Việt trong response (HTML hay JSON-as-string), không có
 * mã lỗi riêng — gom một chỗ vì `gdt-dvc.service.ts` dò đúng cụm này ở hai bước khác nhau
 * (đăng nhập, tra cứu hồ sơ) và trước đây mỗi nơi tự chép lại danh sách cụm từ. */
const LOI_CAPTCHA_CUMS = ["Mã xác nhận không chính xác", "Mã xác thực không chính xác"];

export function laLoiCaptcha(text: string): boolean {
  return LOI_CAPTCHA_CUMS.some((cum) => text.includes(cum));
}

/**
 * Một dòng trong "Danh sách thông báo" của trang chi tiết hồ sơ.
 *
 * CHỈ có đúng 3 trường này trong HTML thật (đối chiếu mẫu ngày 2026-08-19) — cổng KHÔNG có cột
 * "Số thông báo" hay "Người gửi" như suy đoán ban đầu, nên không bịa thêm field rỗng.
 */
export interface ThongBaoDaBoc {
  /** Nội dung/tiêu đề thông báo (vd "V/v: Tiếp nhận hồ sơ thuế điện tử TT19"). */
  tieuDe: string;
  /** Giờ + ngày gửi, dạng thô cổng trả (vd "06:58 29/07/2026") — không parse thành Date, cổng
   * không ghi rõ định dạng giờ 12/24h hay múi giờ, tự suy diễn dễ sai. */
  ngayGui: string;
  /** `idTbao` — truyền vào `taiThongBao`/`downloadthongbao` để tải file thông báo này. */
  idTbao: string;
}

/**
 * Mỗi thông báo là một khối lặp trong modal `#modalThongBao` của trang chi tiết hồ sơ:
 *   <div class="fw-bold">TIÊU ĐỀ</div>
 *   <div>NGÀY GIỜ</div>
 *   ...
 *   <a ... onclick="downloadThongBao(this); return false;" data-id="ID">Tải xuống</a>
 *
 * Không phải bảng `<table>` nên không dùng lại `parseBangHoSo` được — bám vào
 * `onclick="downloadThongBao(...)"` để định vị đúng khối (chuỗi này không xuất hiện ở đâu khác
 * trên trang) thay vì cố khoanh vùng `#modalThongBao` bằng regex (div lồng nhau, không có điểm
 * kết thúc rõ ràng để quét an toàn).
 */
const THONG_BAO_RE =
  /<div class="fw-bold">([\s\S]*?)<\/div>\s*<div>([\s\S]*?)<\/div>[\s\S]*?onclick="downloadThongBao\(this\);\s*return false;"[\s\S]*?data-id="(\d+)"/g;

/** Bóc "Danh sách thông báo" từ HTML trang chi tiết hồ sơ (`layChiTietHoSoHtml`). Rỗng nếu hồ
 * sơ chưa có thông báo nào — bình thường, không phải lỗi. */
export function parseDanhSachThongBao(html: string): ThongBaoDaBoc[] {
  const out: ThongBaoDaBoc[] = [];
  for (const m of html.matchAll(THONG_BAO_RE)) {
    out.push({
      tieuDe: htmlToText(m[1] ?? ""),
      ngayGui: htmlToText(m[2] ?? ""),
      idTbao: m[3] ?? "",
    });
  }
  return out;
}

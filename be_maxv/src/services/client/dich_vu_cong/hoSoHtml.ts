/**
 * Bóc bảng kết quả tra cứu hồ sơ từ MẢNH HTML mà cổng Dịch vụ công trả về.
 *
 * Trang tra cứu chạy bằng htmx nên `GET /tthc/ho-so/search` trả một mảnh HTML để nhét vào
 * `#table-container`, không phải JSON. Muốn hiện lên bảng của mình thì phải bóc ngược ra.
 *
 * Cố tình KHÔNG dùng thư viện parse HTML: mảnh này chỉ có một bảng, mà thêm `cheerio` hay
 * `jsdom` vào backend là kéo theo vài MB phụ thuộc cho đúng một việc. Bù lại bộ bóc bằng
 * regex dưới đây phải chấp nhận là mong manh trước thay đổi markup — nên nó tách hẳn khỏi
 * `gdt-dvc.service.ts`, để cổng đổi giao diện thì chỉ sửa một file.
 */

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

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Nội dung ô -> văn bản thuần.
 *
 * Bỏ hẳn `<script>`/`<style>` trước khi gỡ thẻ: nội dung của chúng KHÔNG phải chữ hiển thị,
 * gỡ thẻ trơn sẽ để lại nguyên đoạn mã trong ô. Ô thao tác (nút tải file, xem thông báo) chỉ
 * còn lại nhãn chữ nếu có — phần hành vi của nút phải xử lý riêng, không bóc ra được bằng
 * cách này.
 */
function cellText(html: string): string {
  let text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  for (const [entity, char] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(char);
  }
  // Số thực thể còn lại (&#8230; …) — đổi nốt cho khỏi lọt mã thô ra bảng.
  text = text.replace(/&#(\d+);/g, (_m, code: string) =>
    String.fromCodePoint(Number(code)),
  );

  return text.replace(/\s+/g, " ").trim();
}

/** Mọi ô của một `<tr>`, theo thứ tự xuất hiện. */
function cellsOf(rowHtml: string): string[] {
  const cells: string[] = [];
  for (const match of rowHtml.matchAll(CELL_RE)) {
    cells.push(cellText(match[2] ?? ""));
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
  const rows = [...bodyHtml.matchAll(ROW_RE)]
    .map((match) => cellsOf(match[1] ?? ""))
    .filter((cells) => cells.length > 0);

  // Không có <thead> nhưng dòng đầu toàn <th> -> đó là tiêu đề, tách ra khỏi dữ liệu.
  if (headers.length === 0 && rows.length > 0 && /<th[\s>]/i.test(bodyHtml)) {
    const firstRowHtml = [...bodyHtml.matchAll(ROW_RE)][0]?.[1] ?? "";
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

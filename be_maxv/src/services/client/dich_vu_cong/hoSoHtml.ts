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
import type { NguonHoSo } from "./nguonTheoNgay";

/** Một bảng đã bóc: tiêu đề cột theo đúng thứ tự cổng trả, và các dòng dữ liệu. */
export interface BangHoSoDaBoc {
  /** Tiêu đề cột lấy từ `<thead>`; rỗng nếu mảnh HTML không có phần đó. */
  headers: string[];
  /** Mỗi dòng là mảng ô theo đúng thứ tự cột. */
  rows: string[][];
  /**
   * Tổng số bản ghi CỔNG KHAI cho bộ lọc này (`bocPhanTrang`) — `null`/vắng mặt = không đọc được.
   *
   * Để người gọi ĐỐI CHIẾU với `rows.length`: lệch nghĩa là chưa lấy hết, phải báo ra thay vì ghi
   * lịch sử "xong, 0 lỗi". `parseBangHoSo` không tự điền (nó chỉ bóc một mảnh HTML); chỗ điền là
   * `traCuuHoSo` sau khi đã gộp đủ các trang.
   */
  tongSoBanGhi?: number | null;
}

/**
 * Khối PHÂN TRANG của trang tra cứu — cổng chia trang mặc định 10 bản ghi/trang.
 *
 * VÌ SAO PHẢI BÓC: `parseBangHoSo` chỉ đọc `<table>`, nên nếu chỉ xin trang đầu thì mọi khoảng có
 * hơn 10 hồ sơ âm thầm mất phần dư — lượt đồng bộ vẫn báo "xong, 0 lỗi". Hai con số này vừa để
 * biết còn trang nào phải lấy, vừa để ĐỐI CHIẾU số dòng bóc được với số cổng khai.
 *
 * `null` = không đọc được (cổng bỏ khối này khi kết quả rỗng, hoặc đổi markup). Phân biệt với `0`:
 * `0` là "cổng nói không có bản ghi nào", `null` là "không biết" — caller không được báo thiếu oan.
 */
export interface PhanTrangDaBoc {
  /** Cổng khai tổng số bản ghi khớp bộ lọc (`Tổng số bản ghi: <span>16</span>`). */
  tongSoBanGhi: number | null;
  /** Tổng số trang (`<span id="totalPage">2</span>`). */
  tongSoTrang: number | null;
}

const TONG_BAN_GHI_RE = /Tổng số bản ghi:\s*<span[^>]*>\s*([\d.,]+)\s*<\/span>/i;
/** Pager tab Dịch vụ công: `<span id="totalPage">2</span>`. */
const TONG_TRANG_DVC_RE = /id="totalPage"[^>]*>\s*([\d.,]+)\s*</i;

/**
 * Pager tab Thuế điện tử: `Trang <span>1</span>/ <span>1</span> — Tổng số bản ghi: …`.
 *
 * Không có `id` nào để bám nên phải neo vào chữ "Trang" và dấu `/`. Hai tab của CÙNG một cổng lại
 * viết pager khác hẳn nhau — gộp thành một biểu thức thì không ai đọc hiểu nổi nữa.
 */
const TONG_TRANG_TDT_RE =
  /Trang\s*<span[^>]*>\s*[\d.,]+\s*<\/span>\s*\/\s*<span[^>]*>\s*([\d.,]+)\s*<\/span>/i;

/** "1.234" / "1,234" -> 1234. Không ra số -> `null`. */
function soNguyen(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[.,\s]/g, ""));
  return Number.isInteger(n) ? n : null;
}

export function bocPhanTrang(html: string): PhanTrangDaBoc {
  return {
    tongSoBanGhi: soNguyen(TONG_BAN_GHI_RE.exec(html)?.[1]),
    // Thử dạng DVC trước rồi mới tới ETAX — thứ tự chỉ có ý nghĩa nếu một mảnh HTML lỡ chứa cả
    // hai, khi đó dạng có `id` là dạng đáng tin hơn.
    tongSoTrang:
      soNguyen(TONG_TRANG_DVC_RE.exec(html)?.[1]) ?? soNguyen(TONG_TRANG_TDT_RE.exec(html)?.[1]),
  };
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
const LOI_CAPTCHA_CUMS = [
  "Mã xác nhận không chính xác",
  "Mã xác thực không chính xác",
  // Tab Thuế điện tử dùng chữ khác hẳn hai tab kia của CÙNG một cổng, và trả kèm HTTP 400 chứ
  // không phải HTML — xem `laLoiCaptchaTdt`.
  "Mã captcha không chính xác",
];

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

/**
 * Link tải thông báo của trang chi tiết nguồn ETAX. Nhận diện bằng `data-loaitracuu="ETAX"` —
 * thuộc tính này CHỈ có ở nguồn đó, nên không đụng nhầm markup của nguồn Dịch vụ công.
 */
const THONG_BAO_TDT_RE =
  /onclick="downloadThongBao\(this\);\s*return false;"[^>]*data-id="(\d+)"[^>]*data-loaitracuu="ETAX"/i;

/**
 * "Danh sách thông báo" của nguồn ETAX — trả TỐI ĐA MỘT mục.
 *
 * Cổng không liệt kê từng thông báo ở nguồn này: trang chi tiết chỉ có một link "Tải xuống" cho cả
 * gói, và `data-id` chính là mã hồ sơ. Bấm vào trả về một ZIP chứa N file XML thông báo.
 *
 * Nên mục trả về ở đây là CẢ GÓI, không phải một thông báo lẻ — tiêu đề nói rõ điều đó, và `ngayGui`
 * để TRỐNG thay vì bịa: cổng không cho ngày nào ở tầng này (ngày nằm trong từng XML bên trong gói).
 */
export class DvcKhongBocDuocThongBaoTdtError extends Error {
  constructor() {
    super("Không bóc được link tải thông báo trên trang chi tiết Thuế điện tử (cổng đổi markup?).");
    this.name = "DvcKhongBocDuocThongBaoTdtError";
  }
}

export function parseThongBaoTdt(html: string): ThongBaoDaBoc[] {
  const m = THONG_BAO_TDT_RE.exec(html);
  // NÉM chứ không trả rỗng. Với nguồn Dịch vụ công, rỗng nghĩa là "hồ sơ chưa có thông báo nào" —
  // hợp lệ. Với ETAX thì KHÔNG: mọi trang chi tiết đều có đúng một link tải, nên rỗng nghĩa là
  // regex đã hỏng (cổng đổi thứ tự thuộc tính chẳng hạn). Trả rỗng ở đây làm vòng thông báo không
  // chạy lần nào -> `thongBaoLoi === 0` -> bật `da_dong_bo=true` -> mọi lượt sau bỏ qua hồ sơ đó:
  // gói ZIP mất VĨNH VIỄN, không dấu vết. Ném thì thành `loi++` và lượt sau tự thử lại.
  if (!m) throw new DvcKhongBocDuocThongBaoTdtError();
  // `khoa` cache có TIỀN TỐ `tdt:`. `data-id` của ETAX chính là mã hồ sơ, mà mã hồ sơ ETAX và
  // `idTbao` của Dịch vụ công đều là chuỗi 17 chữ số do hai bộ sinh khác nhau — dùng chung khoá
  // `dvc_tai_lieu(loai, khoa)` là có ngày một cái đè nội dung của cái kia, im lặng và không cứu
  // được. Tiền tố cũng làm "dòng này là gói của cả hồ sơ" nhìn thấy được ngay trong dữ liệu.
  return [{ tieuDe: "Toàn bộ thông báo (gói ZIP)", ngayGui: "", idTbao: `tdt:${m[1]!}` }];
}

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

// ============================================================
//  GỘP NHIỀU TRANG KẾT QUẢ
//
//  Nằm ở đây (không phải `gdt-dvc.service.ts`) để TÁCH quyết định khỏi I/O: hàm dưới nhận một
//  `layTrang` bất kỳ nên test được đầy đủ mọi điều kiện dừng mà không cần cổng thật — xem
//  `__tests__/dvcGopTrang.test.ts`. Đây đúng là phần đáng khóa nhất: lỗi gốc của cả lượt vá này là
//  "mất dòng mà không ai biết".
// ============================================================

/** Một trang kết quả đã bóc: bảng + khối phân trang đi kèm. */
export interface TrangHoSo {
  bang: BangHoSoDaBoc;
  phanTrang: PhanTrangDaBoc;
}

export interface GopTrangOpts {
  /** Số bản ghi đã XIN mỗi trang — dùng để đoán "trang này đầy, có lẽ còn nữa". */
  size: number;
  /** Trần số trang, chặn vòng lặp vô tận khi cổng trả dữ liệu lạ. */
  maxTrang?: number;
  /** Lượt đã bị lượt mới thay thế -> dừng, khỏi tiêu thêm request cổng cho kết quả không ai đọc. */
  daBiThay?: () => boolean;
}

const MAX_TRANG_MAC_DINH = 50;

/**
 * Đọc 1 ô theo ĐÚNG tên cột (không phải theo thứ tự) — bảng cổng có thể đổi thứ tự cột. Cột vắng
 * mặt -> `""`, cùng quy ước với ô rỗng: nơi gọi không phải phân biệt hai ca đó.
 *
 * Ở `hoSoHtml.ts` vì đây là module sở hữu `BangHoSoDaBoc`. Trước có ba bản y hệt nằm rải rác.
 */
export function oTheoTieuDe(headers: string[], row: string[], tieuDe: string): string {
  const i = headers.indexOf(tieuDe);
  return i >= 0 ? (row[i] ?? "") : "";
}

/** Ô "Mã hồ sơ" của một dòng. */
const maHoSoCuaDong = (headers: string[], row: string[]) =>
  oTheoTieuDe(headers, row, "Mã hồ sơ");

/**
 * Xin từng trang qua `layTrang` rồi gộp lại thành một bảng.
 *
 * CHỐNG TRÙNG bằng "Mã hồ sơ" chứ không tin `page` chạy đúng: nếu cổng lờ tham số đó thì trang 2
 * trả lại y hệt trang 1, cứ nối vào là ra 20 dòng cho 16 bản ghi — sai theo hướng NGƯỢC LẠI với lỗi
 * gốc và khó thấy hơn. Trang nào không thêm được dòng mới thì dừng luôn.
 *
 * KHÔNG đọc được khối phân trang thì KHÔNG dừng mù ở trang đầu — đó chính là lỗi gốc. Trang trả về
 * ĐẦY (đúng bằng `size`) nghĩa là rất có thể còn nữa, cứ xin tiếp; chống trùng lo phần còn lại.
 */
export async function gopCacTrangHoSo(
  layTrang: (page: number) => Promise<TrangHoSo>,
  opts: GopTrangOpts,
): Promise<BangHoSoDaBoc> {
  const maxTrang = opts.maxTrang ?? MAX_TRANG_MAC_DINH;

  let headers: string[] = [];
  const rows: string[][] = [];
  const daThay = new Set<string>();
  let tongSoBanGhi: number | null = null;
  /**
   * Cỡ trang THỰC TẾ cổng dùng, để biết "trang này đầy, có lẽ còn nữa".
   *
   * Khởi tạo bằng cỡ mình XIN, và CHỈ hạ xuống khi có BẰNG CHỨNG cổng ép cỡ khác: trang 1 trả ít
   * hơn số xin trong khi pager nói còn nhiều trang. Cổng thật nghĩ theo đơn vị 10
   * (`onChangePage(2,10)`) nên chuyện nó lờ `size` là có thật.
   *
   * KHÔNG hiệu chuẩn vô điều kiện từ số dòng trang 1: trang đầu ngắn là trường hợp THƯỜNG (ít hồ
   * sơ), coi nó là cỡ trang thì lượt tra cứu nào cũng phải xin thêm một trang nữa để biết đã hết —
   * tốn thêm 1 captcha + 1 request cho mọi lần đồng bộ.
   *
   * Còn lại một khe hẹp: cổng vừa ép cỡ trang VỪA đổi markup pager thì không có gì để đối chiếu,
   * và lượt sẽ dừng sớm. Cảnh báo "không bóc được khối phân trang" bên dưới là dấu vết duy nhất —
   * chấp nhận, vì bịt nó đòi trả giá một request cho mọi lượt.
   */
  let coTrangThucTe = opts.size;

  for (let page = 1; page <= maxTrang; page++) {
    if (opts.daBiThay?.()) break;

    const { bang, phanTrang } = await layTrang(page);

    if (page === 1) {
      headers = bang.headers;
      tongSoBanGhi = phanTrang.tongSoBanGhi;
      if (bang.rows.length > 0 && bang.rows.length < opts.size && (phanTrang.tongSoTrang ?? 1) > 1) {
        coTrangThucTe = bang.rows.length;
        console.warn(
          `[DVC-TRACUU] Cổng ÉP cỡ trang về ${bang.rows.length} dù xin ${opts.size} — ` +
            `lượt tra cứu tốn gấp ~${Math.ceil(opts.size / bang.rows.length)} lần số request.`,
        );
      }
      if (tongSoBanGhi === null && bang.rows.length > 0) {
        // Mất khối phân trang = mất luôn cơ chế đối chiếu. Đừng để im lặng: đây đúng là cách lỗi
        // "chỉ lấy trang đầu" quay lại mà không ai hay.
        console.warn(
          "[DVC-TRACUU] Không bóc được khối phân trang (cổng đổi markup?) — mất cơ chế đối " +
            "chiếu tổng số bản ghi, xem `bocPhanTrang`.",
        );
      }
    } else if (bang.headers.length > 0 && bang.headers.join("|") !== headers.join("|")) {
      // Cột đổi giữa chừng thì `maHoSoCuaDong` (dùng headers trang 1) đọc nhầm cột -> chống trùng
      // sai. Dừng lại và để phần đối chiếu báo thiếu, còn hơn gộp bừa dữ liệu lệch cột.
      console.warn(`[DVC-TRACUU] Cột bảng đổi giữa chừng ở trang ${page} — dừng gộp.`);
      break;
    }

    let themMoi = 0;
    for (const row of bang.rows) {
      // Không bóc được mã (markup lạ) -> vẫn giữ dòng, chỉ không chống trùng được cho nó.
      const ma = maHoSoCuaDong(headers, row);
      if (ma && daThay.has(ma)) continue;
      if (ma) daThay.add(ma);
      rows.push(row);
      themMoi++;
    }

    if (themMoi === 0) break; // hết dữ liệu, hoặc cổng lờ `page` và trả lại trang cũ
    if (phanTrang.tongSoTrang !== null && page >= phanTrang.tongSoTrang) break;
    if (phanTrang.tongSoTrang === null && bang.rows.length < coTrangThucTe) break;
    if (tongSoBanGhi !== null && rows.length >= tongSoBanGhi) break;

    if (page === maxTrang) {
      console.warn(
        `[DVC-TRACUU] Chạm trần ${maxTrang} trang (${rows.length} dòng) — có thể còn hồ sơ chưa ` +
          "lấy; phần đối chiếu `tongSoBanGhi` sẽ báo thiếu.",
      );
    }
  }

  return { headers, rows, tongSoBanGhi };
}

// ============================================================
//  CHUẨN HOÁ BẢNG THEO NGUỒN
// ============================================================

/**
 * Tên cột tab Thuế điện tử -> tên chuẩn (chính là tên tab Dịch vụ công đang dùng).
 *
 * Cần vì `dongBoHoSo` đọc ô theo TÊN cột chứ không theo vị trí — không đổi tên thì mọi ô đọc ra
 * rỗng và hồ sơ lưu xuống trống trơn. Chuẩn hoá về tên DVC (chứ không phải một tên thứ ba) để cột
 * `raw` đã lưu và bộ cột bên FE (`config.ts`, trường `srcHeader`) không phải đổi gì.
 */
const DOI_TEN_COT_TDT: Record<string, string> = {
  "Mã giao dịch": "Mã hồ sơ",
  "Tờ khai/Phụ lục": "Tờ khai",
  "Lần bổ sung": "Lần nộp bổ sung",
  "Nơi nộp": "Cơ quan thuế tiếp nhận",
  "Tiến trình giải quyết hồ sơ (Trạng thái)": "Trạng thái",
};

/**
 * Đổi tên cột của MỘT nguồn về bộ cột chuẩn, giữ nguyên mọi thứ khác.
 *
 * KHÔNG gộp nhiều nguồn: kiến trúc cấm điều đó. Cổng giữ state phía server cho ETAX nên mỗi đoạn
 * ngày phải tra cứu XONG rồi xử lý XONG mới sang đoạn sau (xem `dongBoMotDoan`), tức hai bảng
 * không bao giờ cùng tồn tại. Bản trước nhận mảng nhiều nguồn và hợp cột — máy móc cho một lời gọi
 * mà thiết kế không cho phép, lại còn nhét thêm một cột "Nguồn" giả vào mọi dòng rồi cột đó theo
 * `raw` xuống DB, phá đúng tính chất "raw là dòng nguyên bản cổng trả".
 *
 * Nguồn KHÔNG đi vào bảng: nơi gọi đã biết nó rồi.
 */
export function chuanHoaBangTheoNguon(
  bang: BangHoSoDaBoc,
  nguon: NguonHoSo,
): BangHoSoDaBoc {
  if (nguon !== "tdt") return bang;
  return {
    ...bang,
    headers: bang.headers.map((ten) => DOI_TEN_COT_TDT[ten] ?? ten),
  };
}

/**
 * Diễn giải RESPONSE của cổng eTax GNT (thuedientu.gdt.gov.vn/etaxnnt) — framework DSE (Struts cũ)
 * đóng gói trạng thái pipeline vào 4 input ẩn của mỗi trang trả về, thay vì cookie/CSRF token đơn
 * lẻ như `dichvucong.gdt.gov.vn`. Xem spec mục 2.3 (docs/superpowers/specs/2026-08-25-dvc-giay-nop-tien-etax-design.md).
 *
 * Cùng lý do KHÔNG dùng cheerio/jsdom như `hoSoHtml.ts`: chỉ cần bóc vài input ẩn cụ thể.
 */

/** Trạng thái pipeline DSE của MỘT trang trả về — phải mang nguyên vẹn sang request kế tiếp, xem
 * `gdt-etax-gnt.service.ts`. */
export interface DseState {
  sessionId: string;
  processorId: string;
  processorState: string;
  pageId: string;
}

export class EtaxGntKhongBocDuocDseStateError extends Error {
  constructor() {
    super("Không bóc được trạng thái dse_* từ response của cổng eTax GNT (cổng đổi markup?).");
    this.name = "EtaxGntKhongBocDuocDseStateError";
  }
}

/** Một input ẩn `dse_<tenField>` — bắt giá trị bất kể thứ tự thuộc tính `name=`/`value=` trong thẻ. */
function hiddenInput(html: string, tenField: string): string | null {
  const re = new RegExp(
    `<input[^>]*name="dse_${tenField}"[^>]*value="([^"]*)"|` +
      `<input[^>]*value="([^"]*)"[^>]*name="dse_${tenField}"`,
    "i",
  );
  const m = re.exec(html);
  return m ? (m[1] ?? m[2] ?? "") : null;
}

/** Bóc 4 input ẩn `dse_sessionId`/`dse_processorId`/`dse_processorState`/`dse_pageId` — `null` nếu
 * THIẾU BẤT KỲ field nào (trang không phải một bước pipeline hợp lệ, hoặc cổng đổi markup). */
export function bocDseState(html: string): DseState | null {
  const sessionId = hiddenInput(html, "sessionId");
  const processorId = hiddenInput(html, "processorId");
  const processorState = hiddenInput(html, "processorState");
  const pageId = hiddenInput(html, "pageId");
  if (sessionId === null || processorId === null || processorState === null || pageId === null) {
    return null;
  }
  return { sessionId, processorId, processorState, pageId };
}

/**
 * Bóc URL vé SSO (`https://thuedientu.gdt.gov.vn/etaxnnt/?vnconnect=SSOTHUE&code=...`) từ response
 * của `POST dichvucong.gdt.gov.vn/tthc/sso/redirect-to-service` — hình dạng response CHƯA xác nhận
 * lúc viết (xem spec mục 7.1), nên thử LẦN LƯỢT ba cách, dùng cách đầu tiên khớp:
 *   1. JSON có field `url` hoặc `redirectUrl` chứa domain thuedientu.
 *   2. Toàn bộ body (trim) CHÍNH LÀ url đó.
 *   3. URL nằm lẫn trong văn bản khác (JS/HTML) — regex quét toàn chuỗi.
 */
const VE_SSO_RE = /https:\/\/thuedientu\.gdt\.gov\.vn\/etaxnnt\/\?vnconnect=SSOTHUE[^"'\s<>]*/;

export function bocVeSsoTicketUrl(body: string): string | null {
  const trimmed = body.trim();

  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    for (const field of ["url", "redirectUrl", "data"]) {
      const v = json[field];
      if (typeof v === "string" && VE_SSO_RE.test(v)) return VE_SSO_RE.exec(v)![0];
    }
  } catch {
    // Không phải JSON hợp lệ -> thử hai cách còn lại bên dưới.
  }

  if (VE_SSO_RE.test(trimmed) && trimmed === VE_SSO_RE.exec(trimmed)![0]) return trimmed;

  const m = VE_SSO_RE.exec(body);
  return m ? m[0] : null;
}

/**
 * Danh sách `ctuId` ("id chứng từ", dùng gọi bước `detail`/`download`) theo ĐÚNG thứ tự dòng của
 * bảng kết quả tra cứu GNT — bám vào `data-id="..."` của nút hành động, cùng mẫu `THONG_BAO_RE` ở
 * `hoSoHtml.ts` (cổng dùng chung quy ước gắn id ẩn kiểu này cho các nút tải file).
 *
 * `parseBangHoSo` (hoSoHtml.ts) KHÔNG giữ được giá trị này: nó strip mọi thẻ qua `htmlToText`, nên
 * phải bóc riêng từ HTML THÔ trước khi đưa qua `parseBangHoSo`. Người gọi ghép mảng này với
 * `BangHoSoDaBoc.rows` theo VỊ TRÍ (index cùng thứ tự) — xem `traCuuGnt`.
 */
const CTU_ID_RE = /data-id="(\d+)"/g;

export function bocDanhSachCtuId(html: string): string[] {
  return [...html.matchAll(CTU_ID_RE)].map((m) => m[1]!);
}

/**
 * Diễn giải RESPONSE của cổng eTax GNT (thuedientu.gdt.gov.vn/etaxnnt) — framework DSE (Struts cũ)
 * đóng gói trạng thái pipeline vào 4 input ẩn của mỗi trang trả về, thay vì cookie/CSRF token đơn
 * lẻ như `dichvucong.gdt.gov.vn`. Xem spec mục 2.3 (docs/superpowers/specs/2026-08-25-dvc-giay-nop-tien-etax-design.md).
 *
 * Cùng lý do KHÔNG dùng cheerio/jsdom như `hoSoHtml.ts`: chỉ cần bóc vài input ẩn cụ thể.
 */

/**
 * Trang "cần cài eSigner" của cổng — cổng yêu cầu extension Chrome eSigner.Chrome.TCT để ĐĂNG NHẬP
 * `thuedientu.gdt.gov.vn` (không riêng chức năng ký số), extension này chỉ chạy được trong trình
 * duyệt của người dùng nên KHÔNG THỂ tự động hoá từ backend. Xác nhận sống 2026-08-25: cả trang
 * `dichvucong.gdt.gov.vn/tthc/dich-vu-khac` (trước khi nhảy SSO) lẫn trang hạ cánh trên
 * `thuedientu.gdt.gov.vn` (sau khi nhảy SSO) đều dùng chung câu này khi thiếu extension.
 *
 * Bám vào câu tiếng Việt cố định thay vì cấu trúc HTML (khác `bocDseState`): trang này không có
 * form dse_* nào để bóc theo cấu trúc, chỉ có văn bản thông báo.
 */
const CAN_ESIGNER_RE = /chưa\s+được\s+cài\s+đặt\s+đầy\s+đủ\s+các\s+công\s+cụ/;

export function laTrangCanESigner(html: string): boolean {
  return CAN_ESIGNER_RE.test(html);
}

/** Trạng thái pipeline DSE của MỘT trang trả về — phải mang nguyên vẹn sang request kế tiếp, xem
 * `gdt-etax-gnt.service.ts`. */
export interface DseState {
  sessionId: string;
  processorId: string;
  processorState: string;
  pageId: string;
  /**
   * Bước KẾ TIẾP mà chính trang này khai (`dse_operationName`/`dse_nextEventName` của form ẩn) —
   * dùng để TỰ ĐỘNG submit lại đúng bước đó khi cổng chèn các operation trung gian giữa SSO và
   * `corpQueryTaxProc` (xác nhận sống 2026-08-25: trang hạ cánh sau SSO khai
   * `corpUserLoginProc/startSSO_TTHC` trước khi tới được `corpQueryTaxProc`). Rỗng nếu trang không
   * khai (khi đó không tự động submit tiếp được — người gọi phải tự biết bước kế).
   */
  operationName: string;
  nextEventName: string;
}

export class EtaxGntKhongBocDuocDseStateError extends Error {
  constructor() {
    super("Không bóc được trạng thái dse_* từ response của cổng eTax GNT (cổng đổi markup?).");
    this.name = "EtaxGntKhongBocDuocDseStateError";
  }
}

const INPUT_TAG_RE = /<input\b[^>]*>/gi;

/**
 * MỌI input ẩn (`type="hidden"`) của một trang — dùng để TỰ ĐỘNG submit lại NGUYÊN VẸN một trang
 * trung gian trong chuỗi auto-submit SSO (xem `ganPhienGnt`), thay vì chỉ echo lại 6 field `dse_*`
 * đã biết tên.
 *
 * VÌ SAO CẦN TOÀN BỘ chứ không chỉ `dse_operationName`/`dse_nextEventName`: xác nhận sống
 * 2026-08-25 — chỉ echo 2 field đó làm chuỗi lạc sang trang "Bạn chưa được phân quyền sử dụng chức
 * năng này!" rồi timeout, nhiều khả năng vì bỏ sót field ẩn khác (vd `toOpName`, `module`) mà cổng
 * cần để giữ đúng ngữ cảnh "đang vào module nào" giữa các bước. Một trình duyệt thật auto-submit
 * form thì gửi NGUYÊN mọi input ẩn của form đó — hàm này mô phỏng đúng hành vi đó.
 */
export function bocTatCaInputAn(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(INPUT_TAG_RE)) {
    const tag = m[0];
    if (!/type="hidden"/i.test(tag)) continue;
    const nameMatch = /name="([^"]*)"/i.exec(tag);
    if (!nameMatch) continue;
    const valueMatch = /value="([^"]*)"/i.exec(tag);
    out[nameMatch[1]] = valueMatch ? valueMatch[1] : "";
  }
  return out;
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

/**
 * Bóc input ẩn `dse_sessionId`/`dse_processorId`/`dse_processorState`/`dse_pageId` — `null` nếu
 * thiếu `sessionId`/`processorState`/`pageId` (trang không phải một bước pipeline hợp lệ, hoặc cổng
 * đổi markup).
 *
 * `processorId` KHÔNG bắt buộc: trang ở trạng thái "initial" (chưa xử lý qua operation nào — vd
 * bước "Khởi tạo tra cứu" đầu tiên) không có field này, cổng chỉ cấp processorId SAU KHI xử lý xong
 * một bước. Xác nhận sống 2026-08-25: trang hạ cánh SSO ở `dse_processorState=initial` chỉ có 7
 * input ẩn (sessionId/applicationId/pageId/operationName/errorPage/processorState/nextEventName),
 * không có processorId — thiếu nó KHÔNG có nghĩa là markup hỏng.
 */
export function bocDseState(html: string): DseState | null {
  const sessionId = hiddenInput(html, "sessionId");
  const processorState = hiddenInput(html, "processorState");
  const pageId = hiddenInput(html, "pageId");
  if (sessionId === null || processorState === null || pageId === null) {
    return null;
  }
  const processorId = hiddenInput(html, "processorId") ?? "";
  const operationName = hiddenInput(html, "operationName") ?? "";
  const nextEventName = hiddenInput(html, "nextEventName") ?? "";
  return { sessionId, processorId, processorState, pageId, operationName, nextEventName };
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

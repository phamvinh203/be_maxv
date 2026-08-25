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

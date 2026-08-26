import { describeErrorChain } from "../../../../config/gdt-client";
import {
  schedule as pacerSchedule,
  reportOk as pacerReportOk,
  reportRateLimited as pacerReportRateLimited,
} from "../../hddt/gdtPacer";
import type { DvcPhien } from "../gdt-dvc.service";
import * as DvcService from "../gdt-dvc.service";
import { parseBangHoSo, bocPhanTrang, type BangHoSoDaBoc, type PhanTrangDaBoc } from "../hoSoHtml";
import {
  bocDseState,
  bocVeSsoTicketUrl,
  bocDanhSachCtuId,
  laTrangCanESigner,
  type DseState,
} from "./etaxGntHtml";

/**
 * Client cho cổng eTax GNT cũ (`thuedientu.gdt.gov.vn/etaxnnt`) — framework DSE (Struts), KHÁC hẳn
 * `dichvucong.gdt.gov.vn` (HTMX) mà `gdt-dvc.service.ts` đang nói chuyện. Xem spec:
 * docs/superpowers/specs/2026-08-25-dvc-giay-nop-tien-etax-design.md.
 *
 * Không cần đăng nhập/captcha riêng: `ganPhienGnt` ăn theo phiên DVC đã đăng nhập qua vé SSO
 * (`DvcService.xinVeSsoDichVuKhac`).
 */

const GNT_ORIGIN = "https://thuedientu.gdt.gov.vn";
const GNT_TIMEOUT_MS = 30_000;
const MAX_SSO_REDIRECTS = 5;
/** module `330410` = "Tra cứu GNT" (doanh nghiệp) — CHỈ module này nằm trong phạm vi, xem spec mục 6. */
const GNT_MODULE = "330410";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

export class EtaxGntKhongLayDuocVeSsoError extends Error {
  constructor() {
    super("Không lấy được vé SSO sang cổng eTax GNT — cổng đổi hình dạng response?");
    this.name = "EtaxGntKhongLayDuocVeSsoError";
  }
}

/**
 * Cổng eTax GNT (thuedientu.gdt.gov.vn) yêu cầu cài đặt extension Chrome "eSigner.Chrome.TCT" để
 * ĐĂNG NHẬP — không riêng chức năng ký số, mà là điều kiện đăng nhập nói chung của toàn bộ cổng
 * này. Extension chỉ chạy được trong trình duyệt của người dùng, backend (không có trình duyệt/
 * extension) KHÔNG THỂ tự vượt qua được, và KHÔNG có đường vòng: mọi mục "Doanh nghiệp" trên trang
 * `dich-vu-khac` đều `sso: "Y"` (đối chiếu sống 2026-08-25, không chỉ riêng "Tra cứu GNT"), tức đều
 * phải qua đúng cổng SSO này.
 *
 * KHÔNG thử lại khi gặp lỗi này — đây là giới hạn kiến trúc cố định của cổng, không phải lỗi tạm
 * thời (khác `EtaxGntBuocPipelineThatBaiError`), thử lại chỉ tốn thời gian mà chắc chắn vẫn dính.
 */
export class EtaxGntCanESignerError extends Error {
  constructor() {
    super(
      "Cổng Thuế điện tử (thuedientu.gdt.gov.vn) yêu cầu cài đặt extension eSigner trên trình " +
        "duyệt để đăng nhập — extension này chỉ chạy được trên trình duyệt người dùng nên hệ thống " +
        "không thể tự động đồng bộ Giấy nộp tiền được. Đây là giới hạn của cổng, không phải lỗi hệ thống.",
    );
    this.name = "EtaxGntCanESignerError";
  }
}

export class EtaxGntQuaNhieuRedirectError extends Error {
  constructor() {
    super(`Chuỗi điều hướng SSO vượt quá ${MAX_SSO_REDIRECTS} bước — có thể cổng đã đổi luồng.`);
    this.name = "EtaxGntQuaNhieuRedirectError";
  }
}

/** Lỗi RIÊNG cho một bước pipeline `dse_*` (start/query/detail/download) không bóc được trạng thái
 * kế tiếp — TÁCH khỏi `EtaxGntKhongLayDuocVeSsoError` (chỉ dành cho bước xin/dùng vé SSO) để log
 * và thông báo không nói nhầm "vé SSO" khi thật ra là một bước tra cứu/tải file bị hỏng. */
export class EtaxGntBuocPipelineThatBaiError extends Error {
  constructor(buoc: string) {
    super(`Bước "${buoc}" của pipeline eTax GNT không trả về trạng thái hợp lệ — cổng đổi luồng?`);
    this.name = "EtaxGntBuocPipelineThatBaiError";
  }
}

export interface EtaxGntSession {
  /** Công ty sở hữu — dùng làm khóa pacer, cùng quy ước `DvcSession.donViId`. */
  donViId: string;
  cookies: Map<string, string>;
  dse: DseState;
  /**
   * URL trang trình duyệt "đang đứng" — dùng làm `Referer` cho request KẾ TIẾP, mô phỏng đúng hành
   * vi trình duyệt thật thay vì một giá trị cố định.
   *
   * Xác nhận sống 2026-08-25: gửi CỐ ĐỊNH `Referer: .../etaxnnt/Request` (không kèm query) cho MỌI
   * bước làm server không phục hồi được `toOpName=ssoTTHC` (tham số này KHÔNG nằm trong body của
   * bước `corpUserLoginProc/startSSO_TTHC`, chỉ có trong query string của Referer thật) — hệ quả:
   * rẽ nhầm sang `retailIndexProc` (trang "chưa phân quyền") thay vì `corporateHomeProc`.
   *
   * Quy tắc trình duyệt thật quan sát được: GET giữ NGUYÊN URL (kèm query) làm referer bước sau; response
   * của POST thì bước sau lấy chính URL đích của POST đó (KHÔNG kèm query, vì POST không đổi query
   * string trên thanh địa chỉ) — nên chỉ cần gán lại `= res.url` sau MỌI request là đúng cho cả hai
   * trường hợp (`res.url` của `fetch` luôn là URL thật sự đã gọi).
   */
  referer: string;
}

export interface GntBoLoc {
  /** `dd/MM/yyyy` — form gốc cổng dùng định dạng này (xem spec mục 2.3), KHÔNG phải `yyyy-mm-dd`. */
  tuNgayLap?: string;
  denNgayLap?: string;
  maGiaoDich?: string;
  soGnt?: string;
}

function gntCookieHeader(session: EtaxGntSession): string {
  return [...session.cookies.values()].join("; ");
}

function gntMergeSetCookie(session: EtaxGntSession, response: Response) {
  const setCookie =
    (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const raw of setCookie) {
    const pair = raw.split(";")[0]?.trim();
    if (!pair) continue;
    const name = pair.split("=")[0];
    if (name) session.cookies.set(name, pair);
  }
}

/** Origin thật trước khi nhảy sang thuedientu — Referer của TOÀN BỘ chuỗi redirect SSO (bước
 * B->C->D...) giữ NGUYÊN giá trị này, không đổi theo từng hop (xác nhận sống 2026-08-25: cả request
 * xin vé lẫn `corpJumpProc` đều mang đúng `Referer: https://dichvucong.gdt.gov.vn/`). */
const DICHVUCONG_REFERER = "https://dichvucong.gdt.gov.vn/";

/** Gửi 1 request thô qua pacer làn RIÊNG `"etax-gnt"` (tách khỏi làn `"dvc"` — khác server vật lý,
 * xem Global Constraints). KHÔNG tự theo redirect — dùng `gntSendTheoRedirect` cho chuỗi SSO.
 *
 * `Referer` mặc định lấy từ `session.referer` (ĐỘNG, xem docblock `EtaxGntSession.referer`) —
 * KHÔNG phải giá trị cố định. Người gọi tự truyền `init.headers.Referer` để override khi cần (chuỗi
 * redirect SSO luôn giữ nguyên `DICHVUCONG_REFERER`, xem `gntSendTheoRedirect`).
 */
async function gntSend(url: string, session: EtaxGntSession, init: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Referer: session.referer,
    Origin: GNT_ORIGIN,
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const cookies = gntCookieHeader(session);
  if (cookies) headers.Cookie = cookies;

  let response: Response;
  try {
    response = await pacerSchedule(session.donViId, "etax-gnt", () =>
      fetch(url, {
        ...init,
        headers,
        redirect: "manual",
        signal: init.signal ?? AbortSignal.timeout(GNT_TIMEOUT_MS),
      }),
    );
  } catch (err) {
    pacerReportRateLimited(session.donViId, "etax-gnt");
    console.error(`[DEBUG-GNT] ${url} NÉM LỖI TẦNG FETCH: ${describeErrorChain(err)}`);
    throw err;
  }

  gntMergeSetCookie(session, response);
  if (response.status === 429) pacerReportRateLimited(session.donViId, "etax-gnt");
  else if (response.status < 400) pacerReportOk(session.donViId, "etax-gnt");
  // Referer bước SAU = URL bước NÀY (đúng hành vi trình duyệt thật) — TRỪ chuỗi redirect SSO (giữ
  // nguyên DICHVUCONG_REFERER, tự set lại ở gntSendTheoRedirect nên dòng này vô hại: bị ghi đè ngay).
  session.referer = response.url || url;
  return response;
}

/**
 * Trang `window.location.href = '...'` — cổng dùng kiểu này để chuyển trang GIỮA CÁC BƯỚC SSO thay
 * vì HTTP 3xx thật (xác nhận sống 2026-08-25: response 200 của `EstablishSession` không có dse_*
 * nào mà chỉ có đúng khối script này trỏ sang `/etaxnnt/Request?...dse_operationName=corpJumpProc...`).
 */
const JS_REDIRECT_RE = /window\.location\.href\s*=\s*['"]([^'"]+)['"]/;

/**
 * Đi theo chuỗi redirect tới khi gặp một trang KHÔNG phải điều hướng tiếp — dùng cho chuỗi vé SSO
 * (spec mục 2.2, bước B->C->D->...), nơi mỗi bước là một điều hướng trình duyệt thật. Nhận diện HAI
 * kiểu điều hướng cổng dùng xen kẽ:
 *   1. HTTP 3xx + header `Location` (kiểu chuẩn).
 *   2. Response 200 nhưng body chỉ là `<script>window.location.href = '...'</script>` (kiểu JS
 *      redirect cổng này hay dùng — xem `JS_REDIRECT_RE`).
 */
async function gntSendTheoRedirect(url: string, session: EtaxGntSession): Promise<Response> {
  let currentUrl = url;
  for (let hop = 0; hop < MAX_SSO_REDIRECTS; hop++) {
    // Referer CỐ ĐỊNH `DICHVUCONG_REFERER` cho MỌI hop của chuỗi này (override default
    // `session.referer` của `gntSend`) — xem docblock hằng số đó.
    const res = await gntSend(currentUrl, session, {
      method: "GET",
      headers: { Referer: DICHVUCONG_REFERER },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }

    if (res.status < 300) {
      // Đọc từ BẢN SAO: nếu KHÔNG phải JS-redirect, `res` gốc phải còn nguyên body chưa đọc để
      // người gọi (`ganPhienGnt`) tự đọc lại (`landing.text()`).
      const jsRedirect = JS_REDIRECT_RE.exec(await res.clone().text())?.[1];
      if (jsRedirect) {
        currentUrl = new URL(jsRedirect, currentUrl).toString();
        continue;
      }
    }

    return res;
  }
  throw new EtaxGntQuaNhieuRedirectError();
}

/** Trạng thái ban đầu (rỗng) của một phiên GNT chưa hạ cánh ở đâu cả. */
function dseRong(): DseState {
  return { sessionId: "", processorId: "", processorState: "", pageId: "", operationName: "", nextEventName: "" };
}

/**
 * Chuỗi auto-submit trung gian giữa trang hạ cánh SSO và `corpQueryTaxProc` — ĐÃ XÁC NHẬN SỐNG
 * NGUYÊN VẸN, GIỐNG HỆT, qua 3 lần bắt fixture độc lập (2026-08-25, kể cả một lần từ cửa sổ ẩn danh
 * hoàn toàn sạch — loại trừ khả năng ăn theo phiên cũ):
 *
 *   corpJumpProc (hạ cánh) -> corpUserLoginProc/startSSO_TTHC -> corporateHomeProc/startTTHC
 *   -> corpQueryTaxProc/start (xem `khoiTaoTraCuuGnt`)
 *
 * HARDCODE thay vì TỰ DÒ `dse_operationName`/`dse_nextEventName` của từng trang trung gian: bản tự
 * dò (quét toàn tài liệu tìm input ẩn, xem `bocTatCaInputAn`) từng cho kết quả SAI ở bước thứ hai —
 * nhảy sang `retailIndexProc` (trang "Bạn chưa được phân quyền sử dụng chức năng này!") thay vì
 * `corporateHomeProc`, dù bước đầu dò đúng cả 3 lần. Nhiều khả năng trang `corpUserLoginProc` có
 * NHIỀU HƠN MỘT khối input ẩn (menu/link khác ngoài form auto-submit chính) mà quét cả tài liệu bắt
 * nhầm khối không phải form auto-submit. Chuỗi cố định dưới đây tránh hẳn rủi ro đó.
 */
const AUTO_SUBMIT_CHAIN: readonly { operationName: string; nextEventName: string }[] = [
  { operationName: "corpUserLoginProc", nextEventName: "startSSO_TTHC" },
  { operationName: "corporateHomeProc", nextEventName: "startTTHC" },
];

/**
 * Dựng phiên GNT mới: xin vé SSO bằng phiên DVC đã đăng nhập (`phien`), đi theo chuỗi redirect
 * sang `thuedientu.gdt.gov.vn`, rồi submit đúng `AUTO_SUBMIT_CHAIN` (đã xác nhận sống) để tới được
 * trạng thái sẵn sàng cho `corpQueryTaxProc/start`.
 *
 * VÌ SAO CẦN CHUỖI NÀY: trang hạ cánh đầu tiên sau SSO khai bước kế tiếp là
 * `corpUserLoginProc/startSSO_TTHC`, KHÔNG PHẢI `corpQueryTaxProc` ngay. Nhảy thẳng vào
 * `corpQueryTaxProc/start` (bỏ qua các bước trung gian) làm `dse_pageId` lệch khỏi thứ cổng đang
 * theo dõi phía server -> `500 NullPointerException` (xác nhận sống). Đây đúng kiểu "cổng giữ state
 * phía server, gọi sai thứ tự trong phiên" mà spec ETAX (`2026-08-24-...`) đã cảnh báo.
 *
 * KHÔNG cache qua nhiều lượt — gọi lại từ đầu mỗi lần "Đồng bộ" (xem spec mục 3.1).
 *
 * KHÔNG tự thử lại: xác nhận sống 2026-08-25 — nguyên nhân phổ biến nhất khiến bước hạ cánh/chuỗi
 * auto-submit không bóc được trạng thái là cổng yêu cầu extension eSigner (xem
 * `EtaxGntCanESignerError`), một giới hạn KIẾN TRÚC cố định — thử lại chỉ tốn thời gian mà chắc
 * chắn vẫn dính đúng chỗ đó.
 */
export async function ganPhienGnt(phien: DvcPhien, donViId: string): Promise<EtaxGntSession> {
  const veBody = await DvcService.xinVeSsoDichVuKhac(phien, GNT_MODULE);
  const ticketUrl = bocVeSsoTicketUrl(veBody);
  if (!ticketUrl) {
    // Log NGUYÊN body (cắt bớt) — đây là bước A, hình dạng response CHƯA xác nhận lúc viết
    // (spec mục 7.1). Không log ở nhánh thành công để khỏi in cookie/vé nhạy cảm mỗi lượt chạy.
    console.warn(
      `[DEBUG-GNT] Không bóc được vé SSO từ response bước A (POST sso/redirect-to-service). ` +
        `Body (400 ký tự đầu): ${veBody.slice(0, 400)}`,
    );
    throw new EtaxGntKhongLayDuocVeSsoError();
  }

  const session: EtaxGntSession = {
    donViId,
    cookies: new Map(),
    dse: dseRong(),
    referer: DICHVUCONG_REFERER,
  };
  const landing = await gntSendTheoRedirect(ticketUrl, session);
  const html = await landing.text();
  if (laTrangCanESigner(html)) throw new EtaxGntCanESignerError();
  const dse = bocDseState(html);
  if (!dse) {
    // Log URL cuối cùng dừng lại + status + MỌI đoạn quanh chuỗi "dse_" trong trang (thay vì cắt
    // đầu trang — trang thật dài, phần đầu toàn script theo dõi APM, form dse_* nằm sâu hơn nhiều).
    const boQuanhDse = [...html.matchAll(/.{0,60}dse_[a-zA-Z]+.{0,80}/g)]
      .slice(0, 20)
      .map((m) => m[0].replace(/\s+/g, " ").trim());
    console.warn(
      `[DEBUG-GNT] Không bóc được dse_* từ trang hạ cánh sau SSO. ` +
        `URL cuối cùng: ${landing.url || "(không đọc được)"} — status: ${landing.status} — độ dài HTML: ${html.length}. ` +
        `Số chỗ chứa "dse_": ${boQuanhDse.length}. ` +
        (boQuanhDse.length > 0
          ? `Các đoạn quanh "dse_":\n${boQuanhDse.map((s, i) => `  [${i}] ${s}`).join("\n")}`
          : `HTML (1500 ký tự đầu, không tìm thấy "dse_" nào): ${html.slice(0, 1500)}`),
    );
    throw new EtaxGntKhongLayDuocVeSsoError();
  }
  session.dse = dse;

  // Cảnh báo (KHÔNG chặn) nếu trang hạ cánh khai bước ĐẦU khác với những gì đã xác nhận sống —
  // đây là điểm dò được đúng cả 3/3 lần nên rất khó sai, nhưng nếu cổng đổi thì phải thấy ngay
  // thay vì lặng lẽ submit sai chuỗi.
  if (session.dse.operationName !== AUTO_SUBMIT_CHAIN[0]!.operationName) {
    console.warn(
      `[DEBUG-GNT] Trang hạ cánh SSO khai bước đầu là "${session.dse.operationName}/` +
        `${session.dse.nextEventName}", KHÁC với "${AUTO_SUBMIT_CHAIN[0]!.operationName}/` +
        `${AUTO_SUBMIT_CHAIN[0]!.nextEventName}" đã xác nhận sống — vẫn cứ theo chuỗi cố định, ` +
        `nhưng nếu lượt này lỗi thì đây là chỗ cần xem lại đầu tiên.`,
    );
  }

  for (const buoc of AUTO_SUBMIT_CHAIN) {
    const { dse: tiep } = await guiRequest(session, {
      dse_operationName: buoc.operationName,
      dse_nextEventName: buoc.nextEventName,
    });
    session.dse = tiep;
  }

  return session;
}

/**
 * POST `/etaxnnt/Request` với các field `dse_*` của session hiện tại + field bổ sung, trả HTML thô.
 *
 * `dse_processorId` chỉ đưa vào body khi ĐÃ CÓ giá trị (rỗng ở bước "start" đầu tiên — xem
 * `bocDseState`): đối chiếu 4 curl gốc, bước `start` KHÔNG có field này trong body, còn
 * `query`/`detail`/`download` đều có. Gửi thẳng chuỗi rỗng thay vì bỏ hẳn field có thể khiến cổng
 * hiểu nhầm là "có processorId nhưng rỗng" thay vì "chưa từng có" — an toàn hơn khi bám sát đúng
 * hình dạng cổng đã thấy.
 */
async function guiRequest(
  session: EtaxGntSession,
  extra: Record<string, string>,
): Promise<{ html: string; dse: DseState }> {
  const body = new URLSearchParams({
    dse_sessionId: session.dse.sessionId,
    dse_applicationId: "-1",
    dse_pageId: session.dse.pageId,
    dse_processorState: session.dse.processorState,
    dse_errorPage: "error_page.jsp",
    ...(session.dse.processorId ? { dse_processorId: session.dse.processorId } : {}),
    ...extra,
  });

  const res = await gntSend(`${GNT_ORIGIN}/etaxnnt/Request`, session, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const html = await res.text();
  if (laTrangCanESigner(html)) throw new EtaxGntCanESignerError();
  const dse = bocDseState(html);
  if (!dse) {
    const buoc = `${extra.dse_operationName ?? "?"}/${extra.dse_nextEventName ?? "?"}`;
    const boQuanhDse = [...html.matchAll(/.{0,60}dse_[a-zA-Z]+.{0,80}/g)]
      .slice(0, 20)
      .map((m) => m[0].replace(/\s+/g, " ").trim());
    console.warn(
      `[DEBUG-GNT] Bước "${buoc}" không bóc được dse_* từ response. ` +
        `URL: ${res.url || "(không đọc được)"} — status: ${res.status} — độ dài HTML: ${html.length}. ` +
        `Body đã gửi: ${body.toString()}. ` +
        (boQuanhDse.length > 0
          ? `Các đoạn quanh "dse_":\n${boQuanhDse.map((s, i) => `  [${i}] ${s}`).join("\n")}`
          : `HTML (1500 ký tự đầu, không tìm thấy "dse_" nào): ${html.slice(0, 1500)}`),
    );
    throw new EtaxGntBuocPipelineThatBaiError(buoc);
  }
  return { html, dse };
}

/** Bước "Khởi tạo tra cứu" (spec mục 2.3, bước E) — MỞ operation `corpQueryTaxProc` mới, phải gọi
 * đúng MỘT lần trước lượt `traCuuGnt` đầu tiên của một phiên. */
export async function khoiTaoTraCuuGnt(session: EtaxGntSession): Promise<EtaxGntSession> {
  const { dse } = await guiRequest(session, {
    dse_operationName: "corpQueryTaxProc",
    dse_processorState: "initial",
    dse_nextEventName: "start",
  });
  return { ...session, dse };
}

/**
 * Tra cứu MỘT trang kết quả GNT (bước F). `page` là số trang cổng dùng (tham số `pn`, bắt đầu từ 1).
 *
 * `ctuIds[i]` khớp `bang.rows[i]` theo VỊ TRÍ — `bocDanhSachCtuId` đọc từ HTML THÔ (trước khi
 * `parseBangHoSo` strip thẻ), xem chú thích ở `etaxGntHtml.ts`.
 */
export async function traCuuGnt(
  session: EtaxGntSession,
  boLoc: GntBoLoc,
  page: number,
): Promise<{ session: EtaxGntSession; bang: BangHoSoDaBoc; phanTrang: PhanTrangDaBoc; ctuIds: string[] }> {
  const { html, dse } = await guiRequest(session, {
    dse_operationName: "corpQueryTaxProc",
    dse_nextEventName: "query",
    // errorPage RIÊNG của màn tra cứu — xác nhận sống 2026-08-25, KHÁC "error_page.jsp" mặc định
    // (đó chỉ đúng cho bước "start"). guiRequest ưu tiên field trong `extra` này hơn default của nó.
    dse_errorPage: "/etax/query_tax_information.jsp",
    pn: String(page),
    // Đủ NGUYÊN 22 trường form thật (kể cả để trống) — đối chiếu curl thật 2026-08-25, KHÔNG chỉ 4
    // trường đang dùng: app Java cũ kiểu DSE có thể đòi đủ tên tham số kể cả rỗng.
    sct: "",
    ctuId: "",
    soGnt: "",
    idBke: "",
    type_tax: "01",
    ma_giao_dich: boLoc.maGiaoDich ?? "",
    so_ctu_nh: "",
    so_gnt: boLoc.soGnt ?? "",
    ngay_lap_tu_ngay: boLoc.tuNgayLap ?? "",
    ngay_lap_den_ngay: boLoc.denNgayLap ?? "",
    ngay_gui_tu_ngay: "",
    ngay_gui_den_ngay: "",
    ngay_nop_tu_ngay: "",
    ngay_nop_den_ngay: "",
    ma_nhang: "",
    so_tk: "",
    nguyen_te: "",
    hthuc_nop: "",
    tong_tien_nt_tu: "",
    tong_tien_nt_den: "",
    trang_thai: "",
  });
  return {
    session: { ...session, dse },
    bang: parseBangHoSo(html),
    phanTrang: bocPhanTrang(html),
    ctuIds: bocDanhSachCtuId(html),
  };
}

export interface GntTepTaiVe {
  bytes: Buffer;
  contentType: string;
  fileName: string;
}

/** Tải PDF của một GNT theo `ctuId` (bước G "detail" rồi bước H "download" — spec mục 2.3/3.2: giả
 * định `download` cần đi qua `detail` trước để cổng cấp processorId mới, dựa trên bằng chứng hai
 * bước mang processorId KHÁC nhau). */
export async function taiPdfGnt(
  session: EtaxGntSession,
  ctuId: string,
): Promise<{ session: EtaxGntSession; tep: GntTepTaiVe }> {
  const chiTiet = await guiRequest(session, {
    dse_operationName: "corpQueryTaxProc",
    dse_nextEventName: "detail",
    // Cùng errorPage với bước "query" — xem chú thích ở `traCuuGnt`.
    dse_errorPage: "/etax/query_tax_information.jsp",
    ctuId,
    isReport: "N",
    type: "pdf",
  });
  // Một object DUY NHẤT xuyên suốt phần còn lại của hàm — `gntSend` mutate `.referer`/`.cookies`
  // TRỰC TIẾP trên object nó nhận; tạo bản sao rời rạc cho mỗi lệnh gọi (như bản trước) làm mutation
  // của lệnh SAU bị rơi mất khỏi giá trị trả về.
  const s: EtaxGntSession = { ...session, dse: chiTiet.dse };

  const res = await gntSend(`${GNT_ORIGIN}/etaxnnt/Request`, s, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      dse_sessionId: s.dse.sessionId,
      dse_applicationId: "-1",
      dse_pageId: s.dse.pageId,
      dse_processorState: s.dse.processorState,
      dse_errorPage: "/etax/query_tax_information.jsp",
      dse_operationName: "corpQueryTaxProc",
      dse_nextEventName: "download",
      ctuId,
      isReport: "N",
      type: "pdf",
    }).toString(),
  });

  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "application/pdf";
  const disposition = res.headers.get("content-disposition") ?? "";
  const fileNameMatch = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const fileName = fileNameMatch ? decodeURIComponent(fileNameMatch[1]!) : `gnt-${ctuId}.pdf`;

  return { session: s, tep: { bytes, contentType, fileName } };
}

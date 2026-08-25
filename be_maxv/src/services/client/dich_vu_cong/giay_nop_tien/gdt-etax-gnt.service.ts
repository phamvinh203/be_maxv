import { describeErrorChain } from "../../../../config/gdt-client";
import {
  schedule as pacerSchedule,
  reportOk as pacerReportOk,
  reportRateLimited as pacerReportRateLimited,
} from "../../hddt/gdtPacer";
import type { DvcPhien } from "../gdt-dvc.service";
import * as DvcService from "../gdt-dvc.service";
import { parseBangHoSo, bocPhanTrang, type BangHoSoDaBoc, type PhanTrangDaBoc } from "../hoSoHtml";
import { bocDseState, bocVeSsoTicketUrl, bocDanhSachCtuId, type DseState } from "./etaxGntHtml";

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

export class EtaxGntQuaNhieuRedirectError extends Error {
  constructor() {
    super(`Chuỗi điều hướng SSO vượt quá ${MAX_SSO_REDIRECTS} bước — có thể cổng đã đổi luồng.`);
    this.name = "EtaxGntQuaNhieuRedirectError";
  }
}

export interface EtaxGntSession {
  /** Công ty sở hữu — dùng làm khóa pacer, cùng quy ước `DvcSession.donViId`. */
  donViId: string;
  cookies: Map<string, string>;
  dse: DseState;
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

/** Gửi 1 request thô qua pacer làn RIÊNG `"etax-gnt"` (tách khỏi làn `"dvc"` — khác server vật lý,
 * xem Global Constraints). KHÔNG tự theo redirect — dùng `gntSendTheoRedirect` cho chuỗi SSO. */
async function gntSend(url: string, session: EtaxGntSession, init: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
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
  return response;
}

/** Đi theo chuỗi redirect (3xx + `Location`) tới khi gặp response KHÔNG phải 3xx — dùng cho chuỗi
 * vé SSO (spec mục 2.2, bước B->C->D), nơi mỗi bước là một điều hướng trình duyệt thật. */
async function gntSendTheoRedirect(url: string, session: EtaxGntSession): Promise<Response> {
  let currentUrl = url;
  for (let hop = 0; hop < MAX_SSO_REDIRECTS; hop++) {
    const res = await gntSend(currentUrl, session, { method: "GET" });
    if (res.status < 300 || res.status >= 400) return res;
    const loc = res.headers.get("location");
    if (!loc) return res;
    currentUrl = new URL(loc, currentUrl).toString();
  }
  throw new EtaxGntQuaNhieuRedirectError();
}

/**
 * Dựng phiên GNT mới: xin vé SSO bằng phiên DVC đã đăng nhập (`phien`), đi theo chuỗi redirect
 * sang `thuedientu.gdt.gov.vn`, rồi bóc trạng thái `dse_*` của trang hạ cánh cuối cùng.
 *
 * KHÔNG cache qua nhiều lượt — gọi lại từ đầu mỗi lần "Đồng bộ" (xem spec mục 3.1).
 */
export async function ganPhienGnt(phien: DvcPhien, donViId: string): Promise<EtaxGntSession> {
  const veBody = await DvcService.xinVeSsoDichVuKhac(phien, GNT_MODULE);
  const ticketUrl = bocVeSsoTicketUrl(veBody);
  if (!ticketUrl) throw new EtaxGntKhongLayDuocVeSsoError();

  const session: EtaxGntSession = {
    donViId,
    cookies: new Map(),
    dse: { sessionId: "", processorId: "", processorState: "", pageId: "" },
  };
  const landing = await gntSendTheoRedirect(ticketUrl, session);
  const html = await landing.text();
  const dse = bocDseState(html);
  if (!dse) throw new EtaxGntKhongLayDuocVeSsoError();
  session.dse = dse;
  return session;
}

/** POST `/etaxnnt/Request` với các field `dse_*` của session hiện tại + field bổ sung, trả HTML thô. */
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
    ...extra,
  });

  const res = await gntSend(`${GNT_ORIGIN}/etaxnnt/Request`, session, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const html = await res.text();
  const dse = bocDseState(html);
  if (!dse) throw new EtaxGntKhongLayDuocVeSsoError();
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
    pn: String(page),
    type_tax: "01",
    ngay_lap_tu_ngay: boLoc.tuNgayLap ?? "",
    ngay_lap_den_ngay: boLoc.denNgayLap ?? "",
    ma_giao_dich: boLoc.maGiaoDich ?? "",
    so_gnt: boLoc.soGnt ?? "",
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
    ctuId,
    isReport: "N",
    type: "pdf",
  });

  const res = await gntSend(`${GNT_ORIGIN}/etaxnnt/Request`, { ...session, dse: chiTiet.dse }, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      dse_sessionId: chiTiet.dse.sessionId,
      dse_applicationId: "-1",
      dse_pageId: chiTiet.dse.pageId,
      dse_processorState: chiTiet.dse.processorState,
      dse_errorPage: "error_page.jsp",
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

  return { session: { ...session, dse: chiTiet.dse }, tep: { bytes, contentType, fileName } };
}

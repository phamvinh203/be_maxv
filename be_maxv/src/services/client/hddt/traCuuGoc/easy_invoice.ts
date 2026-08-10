/**
 * ===== TẢI HÓA ĐƠN GỐC — SOFTDREAMS / EasyInvoice (easyinvoice.com.vn + easyinvoice.vn) =====
 *
 * Cổng ASP.NET MVC cổ điển: cookie session + form POST + scrape HTML. Gần giống VNPT nhưng ĐƠN GIẢN
 * HƠN MỘT BẬC — form KHÔNG có `__RequestVerificationToken` (đã kiểm chứng bằng cách đọc HTML
 * `/Search/Index`: các input là `ListInv`, `InvData`, `msg`, `typeSearch`, `FKey`, `Capcha`), nên
 * không phải extract token nào cả.
 *
 * ORIGIN THEO MST NGƯỜI BÁN: mỗi công ty phát hành qua Softdreams có portal riêng
 * `https://<nbmst>hd.<domain>` (vd `0108787907` -> `0108787907hd.easyinvoice.com.vn`). Caller phải
 * truyền `sellerMst`.
 *
 * ⚠️ DOMAIN CÓ HAI: `easyinvoice.com.vn` (tenant cũ) và `easyinvoice.vn` (sau khi Softdreams đổi
 * domain, nhưng không dời hết). Dữ liệu hóa đơn không nói tenant nằm ở đâu nên BE tự DÒ ở bước 1 rồi
 * nhớ theo MST — xem `EASY_DOMAINS` / `layCaptcha`.
 *
 * LUỒNG 3 REQUEST:
 *   1) GET  `/Captcha/Show`  -> ảnh PNG + Set-Cookie `ASP.NET_SessionId`.
 *      ⚠️ CHÍNH REQUEST NÀY MINT SESSION, không phải `/Search/Index`. Đã đo: GET `/Search/Index` trả
 *      200 mà KHÔNG set cookie nào (ASP.NET chỉ tạo session khi có code chạm vào Session — ở đây là
 *      captcha handler). Vì vậy KHÔNG cần tải trang search; bắt đầu thẳng từ đây.
 *   2) POST `/Search/Search` form `typeSearch=&FKey=<fkey>&Capcha=<captcha>` (kèm cookie bước 1)
 *      -> HTML chứa `invToken` trong lời gọi inline `showInv(…, '<token>')`.
 *      ⚠️ Tên field là `Capcha` — THIẾU chữ 't', do backend Softdreams đặt (cùng kiểu lỗi chính tả với
 *      `captch` của VNPT). Gõ đúng `Captcha` là server bỏ qua và luôn báo sai mã.
 *      3 field `ListInv`/`InvData`/`msg` có trong form nhưng bỏ đi vẫn chạy (curl thật đã xác nhận).
 *      ⚠️ TRANG KẾT QUẢ KHÔNG CÓ LINK TẢI — kết quả render CLIENT-SIDE, xem `rutInvToken`.
 *   3) GET  `/Invoice/DownloadPdfAndFileAttach?token=<invToken>` -> bytes zip (có thể qua 302 sang
 *      `/Invoice/Download?fileGuid=…`; cứ để fetch đi theo redirect).
 *
 * THẤT BẠI THÌ LÝ DO Ở ĐÂU: cổng KHÔNG in ra chỗ người đọc, nó nhét vào `<input id="msg">` rồi sweetalert
 * pop lên. Captcha sai -> `msg` = "Nhập đúng mã capcha" (đã bắt được từ response thật). Xem `rutMsg`.
 *
 * ⚠️ FILE TRẢ VỀ LÀ **ZIP** (vd `HOADON_0108787907_1C26TML_35.zip`), khác mọi NCC hiện có. `taiFile`
 * giải nén và CHỈ TRẢ PDF bên trong, nên ra khỏi module này hợp đồng vẫn là "1 file PDF" như các NCC
 * khác — xem docblock `taiFile`.
 *
 * KHÁC VNPT MỘT ĐIỂM QUAN TRỌNG: EasyInvoice gắn session với ĐÚNG 1 ảnh — `layCaptcha` mint session
 * VÀ lấy ảnh trong cùng một request, server không cho xin ảnh khác trên session cũ. Vòng retry của
 * provider `easyInvoice` vì vậy chỉ có 1 cấp: mỗi lượt = session + ảnh mới hoàn toàn (không có vòng
 * "đổi ảnh trong session" như VNPT).
 */

import { describeErrorChain } from "../../../../config/gdt-client";
import { listZipEntryNames, readZipEntryByExtension } from "../../../../helpers/zip";
import { docTotNhat, taoBoDocCaptcha } from "./captchaOcr";
import {
  NAVIGATE_HEADERS,
  assertMst,
  chayThuLai,
  decodeHtmlEntities,
  fetchUpstream,
  htmlToText,
  khopCum,
  laPdf,
  makeDbg,
  makeDeadline,
  mergeSetCookie,
  pdfFromResponse,
} from "./shared";
import { FileHoaDonGoc, ProviderDownloader, TraCuuGocError } from "./types";

// ============================================================
//  CONSTANTS
// ============================================================

const TEN = "EasyInvoice";

/** MST NCC phát hành — khớp entry `0105987432` trong registry FE `TRA_CUU_NCC`. */
export const EASY_INVOICE_MST = "0105987432";

const CAPTCHA_PATH = "/Captcha/Show";
const SEARCH_PATH = "/Search/Search";
const SEARCH_PAGE_PATH = "/Search/Index";
/** Đổi `invToken` lấy file zip (PDF + đính kèm) — đúng endpoint sau nút "Tải PDF & đính kèm". */
const DOWNLOAD_PDF_ATTACH_PATH = "/Invoice/DownloadPdfAndFileAttach";

/**
 * HAI domain portal cùng tồn tại: Softdreams chuyển sang `easyinvoice.vn` nhưng KHÔNG dời hết —
 * tenant cũ vẫn nằm ở `easyinvoice.com.vn`. Không có dấu hiệu nào trong dữ liệu hóa đơn cho biết
 * công ty phát hành thuộc domain nào, nên phải DÒ: thử lần lượt, cái nào mint được session thì thắng.
 *
 * Thứ tự = thứ tự thử. `.com.vn` đứng trước vì đó là hành vi đang chạy được cho phần lớn tenant.
 */
const EASY_DOMAINS = ["easyinvoice.com.vn", "easyinvoice.vn"] as const;

/**
 * MST -> origin đã dò ra, để chỉ tốn 1 lượt dò cho mỗi công ty phát hành thay vì mỗi hóa đơn (một
 * lượt "Tải hóa đơn gốc" thường là hàng chục hóa đơn cùng một người bán).
 *
 * CHỈ ghi khi `/Captcha/Show` trả về ảnh + `ASP.NET_SessionId` — tức subdomain đó có thật và đang
 * phục vụ tenant này. Bị xóa khi cả lượt tải thất bại (xem `easyInvoice.download`), nên đoán sai
 * cũng tự sửa ở lần bấm sau chứ không kẹt tới lúc restart BE.
 *
 * Số phần tử bị chặn bởi số NCC-Softdreams mà khách hàng có hóa đơn — vài chục chuỗi, không cần dọn.
 */
const originTheoMst = new Map<string, string>();

/** Origin portal của 1 MST trên 1 domain. Nhận cả placeholder `{mst}` để dựng URL mẫu cho FE. */
function easyOrigin(mst: string, domain: string): string {
  return `https://${mst}hd.${domain}`;
}

/** Origin ứng viên cho 1 MST (đã `assertMst`), cái dò được lần trước đứng đầu. */
function easyOrigins(mst: string): string[] {
  const tatCa = EASY_DOMAINS.map((domain) => easyOrigin(mst, domain));
  const daBiet = originTheoMst.get(mst);
  // Vẫn GIỮ các ứng viên còn lại phía sau chứ không trả mỗi `daBiet`: nếu NCC dời tenant sang domain
  // kia giữa chừng thì lượt tải tiếp theo tự lần ra, khỏi phải restart BE.
  return daBiet ? [daBiet, ...tatCa.filter((o) => o !== daBiet)] : tatCa;
}

/**
 * Build origin portal tenant EasyInvoice từ `nbmst` (MST người bán): `https://<nbmst>hd.<domain>`.
 * Trả origin ƯU TIÊN — chưa dò lần nào thì là `.com.vn`; xem `EASY_DOMAINS` và `layCaptcha`.
 *
 * GIỮ NGUYÊN MST kể cả đuôi chi nhánh `-001` — chưa gặp mẫu hóa đơn chi nhánh nào để biết Softdreams
 * tách portal theo chi nhánh (như VNPT) hay dùng chung portal MST mẹ. Đừng tự strip đuôi vì đoán:
 * strip sai thì mọi hóa đơn chi nhánh lặng lẽ tra vào portal của công ty khác.
 */
export function buildEasyOrigin(nbmst: string): string {
  return easyOrigins(assertMst(nbmst, TEN))[0];
}

/** Debug logger — bật bằng `DEBUG_EASYINVOICE=1` khi luồng hỏng (NCC đổi template HTML). */
const dbg = makeDbg("EASYINVOICE-DBG", "DEBUG_EASYINVOICE");

// ============================================================
//  OCR — tham số riêng của captcha EasyInvoice (cơ chế đọc ở `captchaOcr.ts`)
// ============================================================

/** Ngưỡng confidence tối thiểu — dưới ngưỡng này coi như đọc hỏng, lấy session + ảnh mới thử lại. */
const MIN_OCR_CONFIDENCE = 35;

/**
 * Cùng bộ tham số đã tinh chỉnh cho `vnpt.ts` (captcha Softdreams cũng là chữ+số, 4–6 ký tự, nhiễu
 * tương tự) — chỉnh lại nếu cổng đổi kiểu captcha. Charset trùng VNPT nên hai provider dùng chung
 * một worker Tesseract, xem `captchaOcr.ts`.
 */
const boDocCaptcha = taoBoDocCaptcha({
  charset: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  thresholds: [180, undefined],
  lenMin: 3,
  lenMax: 7,
  dbg,
});

/**
 * Số lượt thử captcha tối đa — MỖI LƯỢT LÀ 1 SESSION MỚI (ảnh gắn chặt session, xem docblock đầu file)
 * nên cũng là giới hạn số session. Mỗi lượt chỉ tốn 1 GET ảnh + OCR ~200–400ms nên thử dày được.
 */
const MAX_CAPTCHA_RETRIES = 20;

/** Ngân sách thời gian cho 1 lần tải; override bằng env khi cần chờ lâu hơn. */
const retryDeadlineMs = makeDeadline("EASYINVOICE_RETRY_DEADLINE_MS");

// ============================================================
//  SESSION
// ============================================================

/** Session EasyInvoice — chỉ có origin theo tenant + cookie. Không token anti-forgery. */
export interface EasySession {
  /** MST người bán đầy đủ (= nbmst) — để log/debug. */
  nbmst: string;
  /** Origin `https://<nbmst>hd.<domain>` ĐÃ DÒ ĐƯỢC — mọi request sau của phiên bám theo đúng cái này. */
  origin: string;
  /** Raw Cookie header value (`ASP.NET_SessionId=…`), cập nhật sau mỗi response. */
  cookie: string;
}

/** Một lượt captcha: session đã mint + bytes ảnh PNG để nơi gọi tự đọc. */
export interface EasyCaptcha {
  session: EasySession;
  /** Bytes ảnh captcha (PNG) — server cấp gắn với cookie trong `session`, không dùng chéo được. */
  image: Buffer;
}

/**
 * Bước 1: GET `/Captcha/Show` — vừa mint `ASP.NET_SessionId` vừa lấy ảnh captcha trong MỘT request.
 *
 * Gộp hai việc vì chúng không tách được: ảnh chỉ khớp với session cấp cùng lúc, và session cũng chỉ
 * sinh ra ở đây. Lấy ảnh mới = phải dựng session mới, không có chuyện xin ảnh khác trên session cũ.
 *
 * ĐÂY CŨNG LÀ PHÉP DÒ DOMAIN (xem `layCaptcha`): request này là thứ rẻ nhất phân biệt được
 * `.com.vn` với `.vn`, vì nó thất bại rõ ràng ở mọi kiểu sai — DNS không phân giải, 404, hoặc 200
 * mà không cấp cookie.
 */
async function layCaptchaTai(origin: string, sellerMst: string): Promise<EasyCaptcha> {
  const res = await fetchUpstream(
    `${origin}${CAPTCHA_PATH}`,
    {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        referer: `${origin}${SEARCH_PAGE_PATH}`,
      },
    },
    TEN,
  );
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `${TEN} không trả captcha (HTTP ${res.status})`);
  }

  const image = Buffer.from(await res.arrayBuffer());
  if (image.length === 0) {
    throw new TraCuuGocError("UPSTREAM", `${TEN} trả ảnh captcha rỗng`);
  }

  const cookie = mergeSetCookie("", res.headers.getSetCookie());
  if (!cookie) {
    // Không có cookie thì bước search chắc chắn hỏng — báo ngay ở đây cho dễ chẩn đoán, đừng để lỗi
    // hiện ra dưới dạng "captcha sai" ở bước sau.
    throw new TraCuuGocError(
      "UPSTREAM",
      `${TEN} không cấp ASP.NET_SessionId ở ${CAPTCHA_PATH} (đổi cách mint session?)`,
    );
  }
  return { session: { nbmst: sellerMst, origin, cookie }, image };
}

/**
 * Bước 1 + DÒ DOMAIN: thử từng origin ứng viên tới khi một cái mint được session, rồi nhớ lại cho MST
 * đó (`originTheoMst`) nên các hóa đơn sau của cùng người bán không phải dò lại.
 *
 * `assertMst` gọi Ở NGOÀI vòng lặp: MST sai định dạng là lỗi DỨT KHOÁT của đầu vào, không phải "domain
 * này không đúng" — để nó rơi vào vòng dò thì lỗi thật bị nuốt và người dùng đọc ra thông báo sai.
 *
 * Hỏng hết thì ném lỗi của origin ƯU TIÊN chứ không phải lỗi cuối: đó là domain nhiều khả năng đúng
 * nhất (đã dò ra trước đó, hoặc `.com.vn` mặc định), nên thông báo của nó mới đáng đưa cho kế toán.
 */
export async function layCaptcha(sellerMst: string): Promise<EasyCaptcha> {
  const mst = assertMst(sellerMst, TEN);
  const origins = easyOrigins(mst);
  let loiUuTien: unknown = null;

  for (const origin of origins) {
    try {
      const captcha = await layCaptchaTai(origin, sellerMst);
      originTheoMst.set(mst, origin);
      return captcha;
    } catch (err) {
      if (loiUuTien === null) loiUuTien = err;
      dbg("origin không mint được session, thử domain kế", { origin, loi: describeErrorChain(err) });
    }
  }

  throw loiUuTien;
}

/**
 * Giải captcha từ `EasyCaptcha` đã lấy bằng `layCaptcha`. Trả text CHỮ+SỐ đã sạch, hoặc `null` khi
 * không đọc được đủ tự tin — xem `captchaOcr.taoBoDocCaptcha` cho cơ chế đa biến thể × đa PSM.
 *
 * `null` CHỨ KHÔNG ném lỗi: ảnh nhiễu quá là chuyện thường, caller chỉ cần lấy session + ảnh mới thử
 * lại. Lỗi THẬT (không GET được ảnh, ảnh 0 byte) vẫn ném `UPSTREAM` từ `layCaptcha`.
 */
export async function solveCaptcha(captcha: EasyCaptcha): Promise<string | null> {
  return docTotNhat(await boDocCaptcha.doc(captcha.image), MIN_OCR_CONFIDENCE);
}

// ============================================================
//  BƯỚC 2 — SEARCH
// ============================================================

/**
 * Rút `invToken` — vé định danh hóa đơn — từ HTML kết quả search.
 *
 * TRANG KẾT QUẢ KHÔNG CHỨA LINK TẢI. Đã đọc JS của cổng để chắc: server chỉ nhét payload vào
 * `<input id="InvData">` rồi gọi inline
 *   `showInv(str, cusType, clientNotSign, idInvoice, pattern, fKey, attachFile, status, rowPerPage, data, token)`
 * `showInv` (inline trong trang) dựng thanh nút bằng `getToolbarHtml` (`/Content/js/BrowserDetectShare.js`),
 * và nút "Tải PDF & đính kèm" chỉ là `document.location.href = "/Invoice/DownloadPdfAndFileAttach?token=" + invToken`.
 * URL `/Invoice/Download?fileGuid=…` mà DevTools bắt được là do JS/redirect sinh ra Ở BƯỚC SAU, KHÔNG
 * nằm trong HTML — nên dò `fileGuid` trong HTML là dò thứ không bao giờ có ở đó.
 *
 * Token là ĐỐI SỐ CUỐI của `showInv(...)`. Trang lỗi cũng gọi `showInv` nhưng token là chuỗi rỗng,
 * nên "không rút được token" và "search thất bại" trùng nhau — đúng ý.
 */
function rutInvToken(html: string): string {
  // `[^)]*` tham lam -> bắt chuỗi nháy đơn CUỐI CÙNG trước dấu `)`, tức đúng đối số `token`.
  const m = /showInv\([^)]*,\s*'([^']*)'\s*\)/i.exec(html);
  return m ? m[1].trim() : "";
}

/**
 * Rút thông báo lỗi của EasyInvoice từ hidden input `msg`.
 *
 * Trang search KHÔNG in lý do ra chỗ người đọc: server render lại view rồi nhét câu thông báo vào
 * `<input id="msg" name="msg" value="…">`, JS dùng sweetalert pop nó lên. Vì vậy bóc tag rồi đọc text
 * chỉ ra được phần khung trang (tên công ty, hotline, menu) — đúng triệu chứng đã gặp thật:
 *   `trang báo: C&#212;NG TY TNHH … - Cổng thông tin hóa đơn điện tử … Hotline … TRA CỨU HÓA ĐƠN |`
 * Nhìn vào đó tưởng cổng không báo gì, thực ra thông báo nằm trong attribute.
 *
 * Giải entity vì value được HTML-escape (`&#212;` = "Ô").
 */
function rutMsg(html: string): string {
  // Thử cả 2 thứ tự attribute (id trước value, hoặc ngược lại) để chịu được thay đổi template.
  const m =
    /<input[^>]*\bid=["']msg["'][^>]*\bvalue=["']([^"']*)["']/i.exec(html) ??
    /<input[^>]*\bvalue=["']([^"']*)["'][^>]*\bid=["']msg["']/i.exec(html);
  return m ? decodeHtmlEntities(m[1]).trim() : "";
}

/**
 * Thông báo có phải "không tìm thấy hóa đơn" không — tức FKey sai/hết hạn, thử lại vô ích.
 *
 * CHỈ dò phía "không tìm thấy", KHÔNG dò phía "captcha sai": mặc định của `timHoaDon` đã là retryable
 * nên chỉ cần nhận ra ca DỨT KHOÁT. Dò cả hai phía là nhân đôi số chuỗi phải đoán đúng, mà đoán trượt
 * phía captcha thì hỏng nặng hơn (bỏ oan hóa đơn tra được).
 *
 * ĐÃ KIỂM CHỨNG một mẫu: POST với captcha sai cố ý -> `msg` = "Nhập đúng mã capcha" (đúng, cổng cũng
 * viết sai chính tả "capcha" như tên field). Chuỗi đó KHÔNG khớp danh sách dưới đây nên được xếp
 * retryable — đúng ý.
 *
 * Còn phía "không tìm thấy hóa đơn" thì các chuỗi dưới đây vẫn là PHỎNG ĐOÁN — chưa có FKey sai nào
 * đi kèm captcha ĐÚNG để thấy câu thật. Bắt được thì thay bằng nguyên văn.
 */
const KHONG_TIM_THAY_HINTS = ["không tìm thấy", "không tồn tại", "không có hóa đơn", "hết hạn"];

/**
 * Bước 2: POST `/Search/Search` với `FKey` + captcha đã đọc. Trả ĐƯỜNG DẪN TẢI (path trên cùng origin),
 * sẵn sàng cho `taiFile`.
 *
 * @param captcha Chuỗi đọc được từ `EasyCaptcha.image`.
 *
 * Thất bại -> ném `INVALID_CODE` kèm NGUYÊN VĂN thông báo của cổng. `retryable` phân biệt "captcha đọc
 * nhầm" (ảnh mới là qua) với "FKey sai" (thử mấy cũng vô ích) cho vòng lặp bên ngoài.
 */
export async function timHoaDon(
  session: EasySession,
  fkey: string,
  captcha: string,
): Promise<string> {
  const body = new URLSearchParams({ typeSearch: "", FKey: fkey, Capcha: captcha }).toString();

  const res = await fetchUpstream(
    `${session.origin}${SEARCH_PATH}`,
    {
      method: "POST",
      headers: {
        ...NAVIGATE_HEADERS,
        "content-type": "application/x-www-form-urlencoded",
        origin: session.origin,
        referer: `${session.origin}${SEARCH_PAGE_PATH}`,
        cookie: session.cookie,
      },
      body,
    },
    TEN,
  );
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `${TEN} search trả lỗi (HTTP ${res.status})`);
  }

  const html = await res.text();
  session.cookie = mergeSetCookie(session.cookie, res.headers.getSetCookie());

  // Log để đối chiếu: captcha vừa POST lên + kết quả server trả — đọc đúng mà không ra link là vấn đề
  // field/endpoint, đọc sai (khác captcha trong ảnh) là vấn đề OCR.
  dbg("timHoaDon POST kết quả", { fkey, captcha, status: res.status, html });

  const invToken = rutInvToken(html);
  dbg("timHoaDon kết quả", { invToken: invToken || "(rỗng)" });
  if (invToken) return `${DOWNLOAD_PDF_ATTACH_PATH}?token=${encodeURIComponent(invToken)}`;

  // Lý do thất bại nằm ở hidden input `msg`, KHÔNG nằm trong text hiển thị — xem `rutMsg`.
  const msg = rutMsg(html);
  // Payload dạng HÀM: `htmlToText` quét cả trang vài chục KB, chỉ nên chạy khi debug thật sự bật.
  dbg("timHoaDon thất bại", () => ({ msg, text: htmlToText(html).slice(0, 400) }));

  // `retryable` mặc định TRUE: captcha đọc nhầm là nguyên nhân áp đảo, và đoán sai theo hướng này chỉ
  // tốn thêm vài lượt thử, còn đoán sai theo hướng ngược lại thì bỏ oan một hóa đơn vốn tra được.
  // Dò `KHONG_TIM_THAY_HINTS` để cắt bớt ca FKey sai, khỏi đốt hết deadline một cách vô ích.
  throw new TraCuuGocError(
    "INVALID_CODE",
    msg
      ? `${TEN}: ${msg}`
      : `${TEN} không trả link tải cho FKey "${fkey}" và cổng không kèm thông báo nào` +
        " — bật DEBUG_EASYINVOICE=1 rồi xem log `timHoaDon thất bại`",
    !khopCum(msg, KHONG_TIM_THAY_HINTS),
  );
}

// ============================================================
//  BƯỚC 3 — TẢI FILE
// ============================================================

/**
 * Bước 3: GET đường dẫn tải mà `timHoaDon` trả về -> **PDF**.
 *
 * `duongDan` là path tương đối trên cùng origin (thường là `/Invoice/DownloadPdfAndFileAttach?token=…`).
 * KHÔNG đặt `redirect: "manual"`: endpoint token có thể 302 sang `/Invoice/Download?fileGuid=…`, cứ để
 * fetch đi theo — ta chỉ quan tâm bytes cuối cùng.
 *
 * Cổng trả file `.zip` (PDF + XML ký số) chứ không phải PDF trần như mọi NCC khác. BE GIẢI NÉN ngay
 * tại đây và chỉ trả PDF ra ngoài, để hợp đồng `FileHoaDonGoc` giữ nguyên nghĩa "1 file PDF" và FE
 * không phải biết NCC nào đóng gói kiểu gì — `DownloadOriginalDialog` tự đặt tên file `.pdf` và bỏ qua
 * `filename` của BE, nên trả zip ra là kế toán nhận zip mang đuôi `.pdf`.
 *
 * Nhận cả PDF trần phòng khi Softdreams đổi kiểu đóng gói: phân nhánh theo MAGIC BYTES thật chứ không
 * theo đuôi tên file do NCC đặt.
 *
 * MẤT XML: bản XML ký số trong zip bị bỏ. Luồng "tải hóa đơn gốc" chỉ hứa PDF; XML ký số có đường
 * riêng qua cổng thuế (`/invoices/:direction/export-xml`).
 */
export async function taiFile(
  session: EasySession,
  duongDan: string,
  fkey: string,
): Promise<FileHoaDonGoc> {
  const res = await fetchUpstream(
    `${session.origin}${duongDan}`,
    {
      headers: {
        ...NAVIGATE_HEADERS,
        referer: `${session.origin}${SEARCH_PATH}`,
        cookie: session.cookie,
      },
    },
    TEN,
  );
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `${TEN} tải file trả lỗi (HTTP ${res.status})`);
  }

  // Mượn `pdfFromResponse` cho phần dùng chung: body rỗng -> INVALID_CODE, tên file từ
  // Content-Disposition. `contentType` nó gắn sẵn "application/pdf" — đúng với thứ hàm này trả ra.
  // `maDaXacThuc: true` — đã rút được `invToken` ở bước 2 nên FKey chắc chắn đúng; body rỗng ở đây là
  // lỗi tạm thời của cổng, không phải mã sai.
  const file = await pdfFromResponse(res, fkey, TEN, true);
  if (laPdf(file.buffer)) return file;

  const laZip = file.buffer[0] === 0x50 && file.buffer[1] === 0x4b; // "PK"
  if (!laZip) {
    // 200 + HTML báo lỗi là ca hay gặp khi token hết hạn; đừng giao file rác cho kế toán.
    throw new TraCuuGocError(
      "UPSTREAM",
      `${TEN} trả file không phải ZIP/PDF cho FKey "${fkey}" (token hết hạn?)`,
    );
  }

  let pdf: { name: string; data: Buffer } | null;
  try {
    pdf = readZipEntryByExtension(file.buffer, ".pdf");
  } catch (err) {
    // Zip hỏng/định dạng lạ -> lỗi hạ tầng, không phải "mã tra cứu sai".
    throw new TraCuuGocError("UPSTREAM", `${TEN}: không giải nén được ZIP — ${describeErrorChain(err)}`);
  }

  if (!pdf) {
    // Liệt kê tên file bên trong để chẩn đoán ngay, khỏi phải tự tải zip về mở tay.
    const ten = listZipEntryNames(file.buffer).join(", ");
    throw new TraCuuGocError(
      "UPSTREAM",
      `${TEN}: ZIP của FKey "${fkey}" không chứa PDF nào (bên trong: ${ten || "rỗng"})`,
    );
  }

  dbg("taiFile lấy PDF khỏi zip", { fkey, pdf: pdf.name, bytes: pdf.data.length });
  return {
    buffer: pdf.data,
    // Tên trong zip có thể kèm đường dẫn -> lấy phần cuối. FE tự đặt tên khác, đây chỉ là gợi ý.
    filename: pdf.name.split("/").pop() || `${fkey}.pdf`,
    contentType: "application/pdf",
  };
}

// ============================================================
//  PROVIDER — wrapper đầy đủ, tự OCR + retry captcha
// ============================================================

/**
 * Bộ tải EasyInvoice đầy đủ — tự đọc captcha và retry TỚI KHI THÀNH CÔNG. Origin portal tenant build
 * từ `sellerMst` (MST của công ty phát hành — tab đang hiển thị) nên BẮT BUỘC truyền `sellerMst`.
 *
 * Retry 1 cấp (KHÁC VNPT — EasyInvoice gắn session với ĐÚNG 1 ảnh nên không có vòng "đổi ảnh trong
 * session"): mỗi lượt = `layCaptcha` (session + ảnh mới) -> OCR -> POST search. Lặp tới khi lấy được
 * PDF, giới hạn bởi `retryDeadlineMs()` (30s, env `EASYINVOICE_RETRY_DEADLINE_MS`) và
 * `MAX_CAPTCHA_RETRIES` (20 lượt). Ảnh random mỗi lượt, xác suất đúng độc lập, nên càng thử nhiều càng
 * gần chắc chắn đúng.
 *
 * Lỗi `retryable=false` (fkey SAI, UPSTREAM, lỗi khác) -> throw NGAY — session mới không làm fkey đúng
 * hơn, thử tiếp chỉ phí thời gian. `timHoaDon` đã đánh `retryable=true` mặc định khi không thấy link
 * tải (nguyên nhân áp đảo là captcha đọc nhầm) nên vòng retry hoạt động đúng.
 */
export const easyInvoice: ProviderDownloader = {
  mst: EASY_INVOICE_MST,
  ten: TEN,
  canSellerMst: true,
  // Mẫu dùng domain MẶC ĐỊNH — đúng cho phần lớn tenant. Tenant đã dò ra domain kia được ghi đè qua
  // `urlTraCuuTheoMst` bên dưới.
  urlTraCuu: `${easyOrigin("{mst}", EASY_DOMAINS[0])}${SEARCH_PAGE_PATH}`,
  urlTraCuuTheoMst: () =>
    Object.fromEntries(
      Array.from(originTheoMst, ([mst, origin]) => [mst, `${origin}${SEARCH_PAGE_PATH}`]),
    ),
  async download({ code, sellerMst }) {
    try {
      // Ngân sách thời gian, trần số lượt và phân loại lỗi retryable do `chayThuLai` lo; ở đây chỉ
      // còn đúng NỘI DUNG một lượt.
      return await chayThuLai({
        ten: TEN,
        budgetMs: retryDeadlineMs(),
        maxLuot: MAX_CAPTCHA_RETRIES,
        async luot() {
          // Mỗi lượt là session + ảnh mới hoàn toàn (ảnh gắn session, xem docblock đầu file).
          const captcha = await layCaptcha(sellerMst!);
          // OCR hỏng KHÔNG được ném — đây là nhánh hay gặp nhất, session + ảnh mới thử lại thường
          // qua. Trả `null` để bỏ lượt luôn, chưa tốn POST search.
          const captchaText = await solveCaptcha(captcha);
          if (!captchaText) return null;
          const duongDanTai = await timHoaDon(captcha.session, code, captchaText);
          return await taiFile(captcha.session, duongDanTai, code);
        },
      });
    } catch (err) {
      // Quên domain đã dò khi cả lượt hỏng, để lần bấm sau dò lại từ đầu. Cần thiết cho ca xấu nhất
      // của phép dò: subdomain BÊN KIA vẫn tồn tại và vẫn cấp session (DNS wildcard) nhưng không
      // phục vụ tenant này — captcha lấy được nên nó bị nhớ, rồi mọi hóa đơn sau đều tra trượt.
      // Xóa ở đây thì sai lầm đó sống đúng một lượt thay vì tới lúc restart BE.
      originTheoMst.delete(assertMst(sellerMst!, TEN));
      throw err;
    }
  },
};

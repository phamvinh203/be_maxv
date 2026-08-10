

import { describeErrorChain } from "../../../../config/gdt-client";
import { taoBoDocCaptcha } from "./captchaOcr";
import {
  chayThuLai,
  fetchFileGoc,
  fetchUpstream,
  khopCum,
  laPdf,
  makeDbg,
  makeDeadline,
} from "./shared";
import { FileHoaDonGoc, ProviderDownloader, TraCuuGocError } from "./types";

interface CaptchaChallenge {
  /** Khóa phiên gắn với ĐÚNG ảnh này — `/TraCuu` phải gửi lại kèm text đọc được từ nó. */
  key: string;
  /** Bytes ảnh captcha đã giải base64 (cổng trả data-URI, xem `refreshCaptcha`). */
  image: Buffer;
}



const TEN = "CyberLotus";

/** MST NCC phát hành — khóa dispatcher, khớp entry `0105232093` trong registry FE `TRA_CUU_NCC`. */
const CYBERLOTUS_MST = "0105232093";

/** Origin API — dùng cho cả dynamic Web API (`/api/services/…`) lẫn `/File/DownloadTempFile`. */
const API_ORIGIN = "https://bill1app.xcyber.vn";
const API_BASE = `${API_ORIGIN}/api/services/hddt/TraCuuHoaDon`;
const PORTAL_ORIGIN = "https://tracuuhoadon1.xcyber.vn";
/** Trang tra cứu thủ công trên portal — cùng origin với `referer` mà luồng tự động gửi lên. */
const PORTAL_TRA_CUU = `${PORTAL_ORIGIN}/#/tracuuhoadon/tracuu`;


const API_HEADERS: Record<string, string> = {
  accept: "text/plain",
  "content-type": "application/json",
  "x-requested-with": "XMLHttpRequest",
  origin: PORTAL_ORIGIN,
  referer: `${PORTAL_ORIGIN}/`,
};

/** Debug logger — bật bằng `DEBUG_XCYBER=1`. Đường nhanh nhất để thấy DTO mới khi CyberLotus đổi API. */
const dbg = makeDbg("XCYBER-DBG", "DEBUG_XCYBER", 1500);


const MAX_CAPTCHA_RETRIES = 10;
const MAX_CANDIDATES_PER_CAPTCHA = 3;

/** Ngân sách thời gian cho 1 lần tải; override bằng env khi cần chờ lâu hơn. */
const retryDeadlineMs = makeDeadline("XCYBER_RETRY_DEADLINE_MS");

/**
 * Captcha CyberLotus là 5 CHỮ SỐ cố định, nhiễu nặng hơn VNPT/EasyInvoice nên phải quét bảng biến thể
 * rộng hơn (4 cỡ × 6 ngưỡng). Cơ chế đọc ở `captchaOcr.ts`; ở đây chỉ khai tham số.
 */
const boDocCaptcha = taoBoDocCaptcha({
  charset: "0123456789",
  widths: [300, 450, 600, 900],
  thresholds: [100, 130, 160, 190, 220, undefined],
  lenMin: 5,
  lenMax: 5,
  dbg,
});


interface AbpEnvelope {
  result?: unknown;
  success?: boolean;
  error?: { message?: string; details?: string } | null;
}


interface XcyResult {
  message?: string | null;
  /** `/RefreshCaptcha`: khóa phiên captcha. `/TraCuu`: khóa TẢI (khác nghĩa — xem `traCuu`). */
  key?: string | null;
  /** `/RefreshCaptcha`: data URI ảnh captcha. */
  image?: string | null;
  /** `/DownloadPdf`: vé đổi lấy bytes ở `/File/DownloadTempFile`. */
  fileToken?: string | null;
  /** `/DownloadPdf`: tên file gợi ý của NCC. */
  fileName?: string | null;
  fileType?: string | null;
}

/**
 * POST 1 method của TraCuuHoaDonAppService rồi bóc envelope ABP, trả `result` thô (`unknown` — mỗi
 * bước tự narrow vì `DownloadPdf` có thể trả string thay vì object).
 *
 * `body === undefined` -> gửi request KHÔNG body (`/RefreshCaptcha` không nhận tham số).
 */
async function callAbp(method: string, body?: unknown): Promise<unknown> {
  const res = await fetchUpstream(
    `${API_BASE}/${method}`,
    {
      method: "POST",
      headers: API_HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    TEN,
  );

  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    dbg(`${method} HTTP ${res.status}`, raw);
    throw new TraCuuGocError("UPSTREAM", `${TEN} trả lỗi ở ${method} (HTTP ${res.status})`);
  }

  let envelope: AbpEnvelope | null = null;
  try {
    envelope = JSON.parse(raw) as AbpEnvelope;
  } catch (err) {
    dbg(`${method} body không phải JSON`, `${describeErrorChain(err)} | ${raw.slice(0, 300)}`);
    throw new TraCuuGocError("UPSTREAM", `${TEN} trả body không phải JSON ở ${method}`);
  }

  dbg(`${method} result`, envelope?.result);
  // success === false -> lỗi nghiệp vụ, message của ABP là thứ đáng hiển thị nhất cho kế toán.
  if (envelope?.success === false || envelope?.error) {
    const msg = envelope?.error?.message?.trim();
    throw new TraCuuGocError("UPSTREAM", `${TEN}: ${msg || `lỗi không rõ ở ${method}`}`);
  }
  return envelope?.result;
}

/** Ép `result` về DTO `XcyResult` khi nó là object; ngược lại `null` (vd `result` là string trần). */
function asXcyResult(result: unknown): XcyResult | null {
  return result && typeof result === "object" && !Array.isArray(result) ? (result as XcyResult) : null;
}


/**
 * Bóc phần base64 khỏi data-URI (`data:<mime>;base64,XXX`); chuỗi base64 trần thì trả nguyên.
 *
 * Mime KHÔNG cần giữ lại: ảnh đi thẳng vào sharp, mà sharp nhận diện định dạng bằng magic bytes của
 * chính buffer chứ không hỏi mime.
 */
function tachBase64(s: string): string {
  const i = s.indexOf(";base64,");
  return i >= 0 ? s.slice(i + ";base64,".length) : s.trim();
}

/**
 * Bước 1: POST `/RefreshCaptcha` (không body) -> ảnh captcha + khóa phiên.
 *
 * `key` trả về ở đây gắn với ĐÚNG ảnh này — bước `TraCuu` phải gửi lại cặp (key, text người đọc từ
 * ảnh đó). Lấy ảnh mới = key mới, key cũ vứt đi.
 */
async function refreshCaptcha(): Promise<CaptchaChallenge> {
  const r = asXcyResult(await callAbp("RefreshCaptcha"));
  const key = r?.key?.trim();
  const image = r?.image?.trim();
  if (!key || !image) {
    throw new TraCuuGocError("UPSTREAM", `${TEN} không trả captcha (thiếu key hoặc image)`);
  }
  return { key, image: Buffer.from(tachBase64(image), "base64") };
}

// ============================================================
//  BƯỚC 2 — TRA CỨU (đổi captcha lấy khóa tải)
// ============================================================

/**
 * Mẫu câu "captcha sai" của CyberLotus.
 *
 * ĐÃ ĐỐI CHIẾU VỚI RESPONSE THẬT: cổng trả nguyên văn `"Mã xác thực không hợp lệ"` — khớp mục
 * `"mã xác thực"` dưới đây, nên phân loại đang chạy đúng. (Lưu ý VNPT dùng câu KHÁC cho cùng tình
 * huống: `"Mã xác thực không chính xác"` — chung tiền tố, khác đuôi. Đó là lý do dò theo CỤM NGẮN chứ
 * không so nguyên câu.)
 *
 * Các mục còn lại vẫn là dự phòng chưa gặp; giữ vì rẻ và cứu được khi NCC đổi cách diễn đạt.
 *
 * VNPT từng dính bẫy ở chỗ này: bản đầu đoán 3 biến thể thì cả 3 đều sai chữ, khiến mọi lỗi captcha bị
 * gán nhãn "mã tra cứu sai" — báo cho kế toán một nguyên nhân bịa. Hai lớp bù vẫn giữ nguyên:
 *   - thông báo GỐC của NCC luôn được ném kèm nguyên văn, nên dù phân loại sai thì người dùng vẫn đọc
 *     được lý do thật;
 *   - `TraCuu` không kèm message thì mặc định coi là captcha sai (`retryable`), vì đó là nguyên nhân
 *     áp đảo — sai mã tra cứu thì NCC có nói lý do.
 */
const CAPTCHA_ERR_HINTS = ["captcha", "mã xác thực", "mã bảo vệ", "mã kiểm tra"];


/**
 * Bước 2: POST `/TraCuu` { key, captcha, maSoBiMat } -> trả KHÓA TẢI cho bước 3.
 *
 * ⚠️ HAI CHỮ `key` KHÁC NGHĨA NHAU:
 *   - `key` GỬI LÊN  = khóa phiên captcha (từ `refreshCaptcha`).
 *   - `key` NHẬN VỀ  = khóa tải, thứ mà `/DownloadPdf` cần.
 * Bằng chứng: request `DownloadPdf` bắt được ở DevTools mang `key` KHÁC hẳn `key` của `TraCuu` ngay
 * trước nó, mà lại KHÔNG kèm captcha — nếu nó vẫn là khóa captcha thì server buộc phải đòi captcha.
 *
 * Không có key mới = thất bại. `retryable` phân biệt hai nguyên nhân cho vòng retry của provider:
 * captcha đọc nhầm (ảnh mới là qua) vs mã tra cứu sai (thử mấy cũng vô ích) — giống cách `vnpt.ts` làm.
 */
async function traCuu(captchaKey: string, captchaText: string, maSoBiMat: string): Promise<string> {
  const r = asXcyResult(
    await callAbp("TraCuu", { key: captchaKey, captcha: captchaText, maSoBiMat }),
  );

  const key = r?.key?.trim();
  if (key) return key;

  // Ném kèm NGUYÊN VĂN thông báo của NCC — người dùng đọc được lý do thật kể cả khi phân loại trượt.
  const message = r?.message?.trim() || "";
  const loiCaptcha = khopCum(message, CAPTCHA_ERR_HINTS) || !message;
  throw new TraCuuGocError(
    "INVALID_CODE",
    message
      ? `${TEN}: ${message}`
      : `${TEN} không trả khóa tải cho mã "${maSoBiMat}" (captcha sai, hoặc mã sai/hết hạn tra cứu)`,
    loiCaptcha,
  );
}

// ============================================================
//  BƯỚC 3 — TẢI PDF
// ============================================================

/**
 * Bước 4: GET `/File/DownloadTempFile` — đổi `fileToken` lấy bytes. Endpoint này KHÔNG bọc envelope
 * ABP, nó stream binary như mọi cổng NCC khác nên dùng thẳng `shared.fetchFileGoc` (lo hộ non-ok,
 * body rỗng, tên file từ Content-Disposition).
 *
 * `fileName`/`fileType` vẫn phải gửi lên query dù ta không cần: server dùng chúng để đặt
 * Content-Disposition, thiếu thì file tải về mất tên.
 */
async function downloadTempFile(dto: XcyResult, maSoBiMat: string): Promise<FileHoaDonGoc> {
  const fileName = dto.fileName?.trim() || `${maSoBiMat}.pdf`;
  const params = new URLSearchParams({
    fileToken: dto.fileToken!.trim(),
    fileName,
    fileType: dto.fileType?.trim() || "application/pdf",
  });

  const file = await fetchFileGoc({
    url: `${API_ORIGIN}/File/DownloadTempFile?${params}`,
    headers: {
      accept: "application/pdf,application/octet-stream,*/*",
      referer: `${PORTAL_ORIGIN}/`,
    },
    code: maSoBiMat,
    ten: TEN,
    // Đã đổi được `fileToken` ở bước 3 nên mã tra cứu chắc chắn đúng; body rỗng = token hết hạn.
    maDaXacThuc: true,
  });

  // Cổng trả 200 + HTML báo lỗi khi token hết hạn -> soi magic để không giao file rác cho kế toán.
  if (!laPdf(file.buffer)) {
    throw new TraCuuGocError("UPSTREAM", `${TEN}: DownloadTempFile không trả PDF cho mã "${maSoBiMat}"`);
  }
  return { ...file, filename: fileName, contentType: "application/pdf" };
}

/**
 * Bước 3: POST `/DownloadPdf` { key, maSoBiMat }. KHÔNG trả bytes — chỉ metadata + `fileToken`, phải
 * đổi tiếp ở bước 4. Cũng KHÔNG cần captcha (đã tiêu ở bước 2).
 */
async function downloadPdf(downloadKey: string, maSoBiMat: string): Promise<FileHoaDonGoc> {
  const result = await callAbp("DownloadPdf", { key: downloadKey, maSoBiMat });
  const dto = asXcyResult(result);
  if (dto?.fileToken?.trim()) return downloadTempFile(dto, maSoBiMat);

  // Không có token -> in shape thật để sửa nhanh, đừng để lỗi mơ hồ "không tải được".
  const shape =
    result && typeof result === "object"
      ? Object.entries(result)
          .map(([k, v]) => `${k}:${typeof v}${typeof v === "string" ? `(${v.length})` : ""}`)
          .join(", ")
      : typeof result;
  dbg("DownloadPdf không có fileToken — shape result", shape);
  const message = dto?.message?.trim();
  throw new TraCuuGocError(
    message ? "INVALID_CODE" : "UPSTREAM",
    message
      ? `${TEN}: ${message}`
      : `${TEN} không trả fileToken cho mã "${maSoBiMat}" (result: ${shape}) — bật DEBUG_XCYBER=1 để xem chi tiết`,
  );
}

// ============================================================
//  PROVIDER
// ============================================================

/**
 * Bộ tải CyberLotus tự OCR captcha trong BE. Mỗi ảnh có thể cho nhiều ứng viên OCR; CyberLotus cho phép
 * thử nhiều text trên cùng captcha key, nên provider thử vài ứng viên trước khi lấy ảnh mới.
 */
export const cyberlotus: ProviderDownloader = {
  mst: CYBERLOTUS_MST,
  ten: TEN,
  urlTraCuu: PORTAL_TRA_CUU,
  async download({ code }) {
    // Vòng ngoài (ngân sách thời gian + trần số lượt + phân loại lỗi) do `chayThuLai` lo; 1 lượt ở
    // đây = 1 ảnh captcha, thử tối đa `MAX_CANDIDATES_PER_CAPTCHA` ứng viên OCR của ảnh đó.
    return chayThuLai({
      ten: TEN,
      budgetMs: retryDeadlineMs(),
      maxLuot: MAX_CAPTCHA_RETRIES,
      async luot(conHan) {
        const challenge = await refreshCaptcha();
        const candidates = await boDocCaptcha.doc(challenge.image);
        // Ứng viên nào cũng sai thì để lỗi cuối thoát ra cho `chayThuLai` ghi nhận (nó đi vào thông
        // báo "lỗi lượt cuối"), thay vì nuốt mất rồi báo chung chung.
        let loiCaptcha: unknown = null;

        for (const candidate of candidates.slice(0, MAX_CANDIDATES_PER_CAPTCHA)) {
          if (!conHan()) break;
          try {
            const downloadKey = await traCuu(challenge.key, candidate.text, code);
            return await downloadPdf(downloadKey, code);
          } catch (err) {
            // Thử ứng viên KHÁC trên cùng ảnh trước đã (rẻ hơn hẳn xin ảnh mới) nên bắt ở đây.
            if (err instanceof TraCuuGocError && err.retryable) {
              dbg("captcha OCR sai, thử candidate/ảnh tiếp theo", candidate);
              loiCaptcha = err;
              continue;
            }
            throw err;
          }
        }
        if (loiCaptcha) throw loiCaptcha;
        return null;
      },
    });
  },
};

// ============================================================
//  NOTES
//  - NCC ĐỔI DTO / luồng hỏng: bật `DEBUG_XCYBER=1`, xem log `TraCuu result` + `DownloadPdf result`.
//  - `tracuuhoadon1` có chữ `1` nghi là số hiệu shard. Gặp hóa đơn CyberLotus tra không ra thì kiểm
//    tra xem tenant đó có nằm ở cổng khác (`tracuuhoadon2`…) với API base khác không.
// ============================================================

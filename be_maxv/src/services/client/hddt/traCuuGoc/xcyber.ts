

import { createWorker, PSM } from "tesseract.js";
import type { Worker } from "tesseract.js";
import sharp from "sharp";
import { describeErrorChain } from "../../../../config/gdt-client";
import { fetchFileGoc, fetchUpstream, makeDbg } from "./shared";
import { FileHoaDonGoc, ProviderDownloader, TraCuuGocError } from "./types";

interface CaptchaChallenge {
  /** Khóa phiên gắn với ĐÚNG ảnh này — `/TraCuu` phải gửi lại kèm text đọc được từ nó. */
  key: string;
  /** Data URI ảnh (`data:image/png;base64,…`). */
  image: string;
}



const TEN = "CyberLotus";

/** MST NCC phát hành — khóa dispatcher, khớp entry `0105232093` trong registry FE `TRA_CUU_NCC`. */
const CYBERLOTUS_MST = "0105232093";

/** Origin API — dùng cho cả dynamic Web API (`/api/services/…`) lẫn `/File/DownloadTempFile`. */
const API_ORIGIN = "https://bill1app.xcyber.vn";
const API_BASE = `${API_ORIGIN}/api/services/hddt/TraCuuHoaDon`;
const PORTAL_ORIGIN = "https://tracuuhoadon1.xcyber.vn";


const API_HEADERS: Record<string, string> = {
  accept: "text/plain",
  "content-type": "application/json",
  "x-requested-with": "XMLHttpRequest",
  origin: PORTAL_ORIGIN,
  referer: `${PORTAL_ORIGIN}/`,
};

/** Debug logger — bật bằng `DEBUG_XCYBER=1`. Đường nhanh nhất để thấy DTO mới khi CyberLotus đổi API. */
const dbg = makeDbg("XCYBER-DBG", "DEBUG_XCYBER", 1500);


const CAPTCHA_CHARSET = "0123456789";
const CAPTCHA_LEN = 5;
const OCR_WIDTHS = [300, 450, 600, 900] as const;
const PREPROCESS_THRESHOLDS: (number | undefined)[] = [100, 130, 160, 190, 220, undefined];
const CAPTCHA_PSMS = [PSM.SINGLE_LINE, PSM.SINGLE_WORD] as const;
const MAX_CAPTCHA_RETRIES = 10;
const MAX_CANDIDATES_PER_CAPTCHA = 3;

function retryDeadlineMs(): number {
  return Number(process.env.XCYBER_RETRY_DEADLINE_MS) || 30_000;
}

interface CaptchaRead {
  text: string;
  confidence: number;
}

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng", 1, { logger: () => {} });
      await worker.setParameters({ tessedit_char_whitelist: CAPTCHA_CHARSET });
      return worker;
    })();
  }
  return workerPromise;
}

async function preprocessCaptcha(image: Buffer): Promise<Buffer[]> {
  try {
    const variants: Buffer[] = [];
    for (const width of OCR_WIDTHS) {
      for (const threshold of PREPROCESS_THRESHOLDS) {
        const pipeline = sharp(image)
          .resize({ width, kernel: "lanczos3" })
          .grayscale()
          .normalize();
        variants.push(
          await (threshold === undefined ? pipeline : pipeline.threshold(threshold).median(3))
            .png()
            .toBuffer(),
        );
      }
    }
    return variants;
  } catch (err) {
    dbg("preprocessCaptcha lỗi — OCR ảnh gốc", describeErrorChain(err));
    return [image];
  }
}

function captchaImageBuffer(challenge: CaptchaChallenge): Buffer {
  return Buffer.from(tachBase64(challenge.image), "base64");
}

async function solveCaptcha(challenge: CaptchaChallenge): Promise<CaptchaRead[]> {
  const worker = await getWorker();
  const variants = await preprocessCaptcha(captchaImageBuffer(challenge));
  const reads: CaptchaRead[] = [];

  for (const psm of CAPTCHA_PSMS) {
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    for (const variant of variants) {
      const { data } = await worker.recognize(variant);
      const text = (data.text || "").replace(/[^0-9]/g, "");
      if (text.length === CAPTCHA_LEN) {
        reads.push({ text, confidence: data.confidence });
      }
    }
  }

  const unique: CaptchaRead[] = [];
  for (const read of reads.sort((a, b) => b.confidence - a.confidence)) {
    if (!unique.some((x) => x.text === read.text)) unique.push(read);
  }
  dbg("solveCaptcha reads", unique);
  return unique;
}


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


function chuanHoaAnhCaptcha(raw: string): string {
  const base64 = tachBase64(raw);
  const magic = Buffer.from(base64.slice(0, 16), "base64").subarray(0, 4).toString("hex");
  const mime = magic.startsWith("89504e47")
    ? "image/png"
    : magic.startsWith("ffd8ff")
      ? "image/jpeg"
      : "image/png"; // không nhận ra -> PNG (giá trị quan sát được duy nhất tới giờ)
  return `data:${mime};base64,${base64}`;
}

/** Bóc phần base64 khỏi data-URI (`data:<mime>;base64,XXX`); chuỗi base64 trần thì trả nguyên. */
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
  return { key, image: chuanHoaAnhCaptcha(image) };
}

// ============================================================
//  BƯỚC 2 — TRA CỨU (đổi captcha lấy khóa tải)
// ============================================================

/**
 * Mẫu câu "captcha sai" của CyberLotus — PHỎNG ĐOÁN, chưa đối chiếu với chuỗi nguyên văn của NCC.
 *
 * VNPT từng dính đúng chỗ này: bản đầu đoán 3 biến thể thì cả 3 đều sai chữ, khiến mọi lỗi captcha bị
 * gán nhãn "mã tra cứu sai" — báo cho kế toán một nguyên nhân bịa. Hai lớp bù ở đây:
 *   - thông báo GỐC của NCC luôn được ném kèm nguyên văn, nên dù phân loại sai thì người dùng vẫn đọc
 *     được lý do thật;
 *   - `TraCuu` không kèm message thì mặc định coi là captcha sai (`retryable`), vì đó là nguyên nhân
 *     áp đảo — sai mã tra cứu thì NCC có nói lý do.
 * Bắt được chuỗi thật (bật `DEBUG_XCYBER=1`, xem log `TraCuu result`) thì THAY danh sách này.
 */
const CAPTCHA_ERR_HINTS = ["captcha", "mã xác thực", "mã bảo vệ", "mã kiểm tra"];

/** Có phải thông báo về captcha không. Chuẩn hóa NFC + lowercase trước khi so: tiếng Việt về dạng tổ
 * hợp (NFD) sẽ trượt mọi so sánh với literal NFC trong file này dù chữ hiện ra y hệt. */
function laLoiCaptcha(message: string): boolean {
  const m = message.normalize("NFC").toLowerCase();
  return CAPTCHA_ERR_HINTS.some((h) => m.includes(h.normalize("NFC")));
}

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
  const loiCaptcha = laLoiCaptcha(message) || !message;
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
  });

  // Cổng trả 200 + HTML báo lỗi khi token hết hạn -> soi magic để không giao file rác cho kế toán.
  if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
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
  async download({ code }) {
    const budgetMs = retryDeadlineMs();
    const deadline = Date.now() + budgetMs;
    let lastErr: unknown = new TraCuuGocError(
      "UPSTREAM",
      `${TEN}: không tải được hóa đơn trong ${budgetMs / 1000}s retry captcha OCR`,
    );

    for (let attempt = 0; attempt < MAX_CAPTCHA_RETRIES && Date.now() < deadline; attempt++) {
      const challenge = await refreshCaptcha();
      const candidates = await solveCaptcha(challenge);
      if (candidates.length === 0) continue;

      for (const candidate of candidates.slice(0, MAX_CANDIDATES_PER_CAPTCHA)) {
        if (Date.now() >= deadline) break;
        try {
          const downloadKey = await traCuu(challenge.key, candidate.text, code);
          return await downloadPdf(downloadKey, code);
        } catch (err) {
          lastErr = err;
          if (err instanceof TraCuuGocError && err.retryable) {
            dbg("captcha OCR sai, thử candidate/ảnh tiếp theo", candidate);
            continue;
          }
          throw err;
        }
      }
    }

    throw lastErr;
  },
};

// ============================================================
//  NOTES
//  - NCC ĐỔI DTO / luồng hỏng: bật `DEBUG_XCYBER=1`, xem log `TraCuu result` + `DownloadPdf result`.
//  - `tracuuhoadon1` có chữ `1` nghi là số hiệu shard. Gặp hóa đơn CyberLotus tra không ra thì kiểm
//    tra xem tenant đó có nằm ở cổng khác (`tracuuhoadon2`…) với API base khác không.
// ============================================================

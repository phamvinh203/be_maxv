/**
 * Helper DÙNG CHUNG cho mọi bộ tải hóa đơn gốc (MISA, và các NCC sau). Gom hết boilerplate ở đây để
 * mỗi NCC chỉ khai báo phần KHÁC NHAU (URL, cách lấy token, header). Thêm NCC mới gần như không lặp code.
 */

import { describeErrorChain } from "../../../../config/gdt-client";
import { FileHoaDonGoc, TraCuuGocError } from "./types";

/** UA trình duyệt thật — các cổng NCC sau Cloudflare thường chặn UA "lạ". */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";

/** Timeout mỗi request tới cổng NCC — chặn 1 socket treo làm kẹt cả lượt tải nhiều hóa đơn. */
const TIMEOUT_MS = 30_000;

/** Rút `filename` từ header Content-Disposition (vd `inline; filename=abc.pdf`, có/không nháy). */
export function filenameFromDisposition(disposition: string | null): string {
  if (!disposition) return "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return m ? decodeURIComponent(m[1].trim()) : "";
}

/**
 * Bước "mint token": POST form-urlencoded, parse JSON, rút token qua `pick`. Ném `UPSTREAM` nếu NCC
 * không phản hồi / trả lỗi / không có token. `pick` nhận JSON đã parse (unknown) và trả token | undefined.
 */
export async function mintTokenForm(opts: {
  url: string;
  body: string;
  headers?: Record<string, string>;
  pick: (json: unknown) => string | undefined;
  ten: string;
}): Promise<string> {
  const { url, body, headers = {}, pick, ten } = opts;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "user-agent": BROWSER_UA,
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        accept: "application/json, text/javascript, */*; q=0.01",
        ...headers,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new TraCuuGocError("UPSTREAM", `Không lấy được token từ ${ten}: ${describeErrorChain(err)}`);
  }
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `${ten} từ chối cấp token (HTTP ${res.status})`);
  }
  const token = pick((await res.json().catch(() => null)) as unknown);
  if (!token) {
    throw new TraCuuGocError("UPSTREAM", `${ten} không trả token tải hóa đơn`);
  }
  return token;
}

/**
 * Bước "tải file PDF": GET với header của NCC, trả `{ buffer, filename, contentType }`. Quy ước chung
 * cho MỌI NCC:
 *  - lỗi mạng/timeout/không phản hồi -> `UPSTREAM`;
 *  - body RỖNG (0 byte) -> `INVALID_CODE` (nhiều cổng vẫn trả 200 khi mã sai/không tồn tại);
 *  - tên file lấy từ Content-Disposition, thiếu thì `<code>.pdf`.
 */
export async function fetchFileGoc(opts: {
  url: string;
  headers: Record<string, string>;
  code: string;
  ten: string;
}): Promise<FileHoaDonGoc> {
  const { url, headers, code, ten } = opts;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "user-agent": BROWSER_UA, ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new TraCuuGocError("UPSTREAM", `Không tải được file từ ${ten}: ${describeErrorChain(err)}`);
  }
  if (!res.ok) {
    throw new TraCuuGocError("UPSTREAM", `${ten} trả lỗi khi tải file (HTTP ${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) {
    throw new TraCuuGocError(
      "INVALID_CODE",
      `Không tìm thấy hóa đơn gốc ${ten} cho mã "${code}" (mã sai hoặc đã hết hạn tra cứu)`,
    );
  }

  const filename = filenameFromDisposition(res.headers.get("content-disposition")) || `${code}.pdf`;
  return { buffer, filename, contentType: "application/pdf" };
}

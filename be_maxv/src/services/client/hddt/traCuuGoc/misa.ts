/**
 * ===== TẢI HÓA ĐƠN GỐC — MISA (meinvoice.vn) =====
 *
 * Bộ tải file gốc (PDF / XML ký số) của hóa đơn do MISA phát hành. FE không gọi thẳng meinvoice được
 * (không có CORS + cần header điều hướng iframe), nên đi qua BE proxy này — giống cách gọi GDT.
 *
 * LUỒNG 2 REQUEST (reverse-engineer từ JS trang tra-cuu, kiểm chứng bằng curl — xem
 * docs/specs/2026-08-05-tai-hoa-don-goc-misa.md):
 *
 *   1) POST /tra-cuu/GetRequestTimeEnCode (form `code`) -> { data: "<ext>" }
 *      `ext` là token mã-hóa-thời-gian, HẾT HẠN NHANH, KHÔNG gắn theo mã hóa đơn -> mint mới mỗi lần.
 *
 *   2) GET /tra-cuu/tra-cuu/DownloadHandler.ashx?Type=pdf&Viewer=1&ext=<ext>&Code=<maTraCuu>
 *      ⚠️ BẮT BUỘC gửi header "điều hướng iframe" (sec-fetch-dest: iframe, accept: text/html,
 *      upgrade-insecure-requests…). Thiếu -> handler trả 200 nhưng BODY RỖNG (0 byte). Trang thật
 *      nhúng file vào <iframe id="frmResult"> nên đây là navigation, không phải XHR.
 *      Đường dẫn `/tra-cuu/tra-cuu/` đôi là do URL tương đối dựng từ trang ở thư mục `/tra-cuu/`.
 *      Body rỗng -> `shared.fetchFileGoc` tự coi là INVALID_CODE (mã sai / không tìm thấy).
 */

import { fetchFileGoc, mintTokenForm } from "./shared";
import { ProviderDownloader } from "./types";

const MISA_ORIGIN = "https://www.meinvoice.vn";
const MISA_TRA_CUU = `${MISA_ORIGIN}/tra-cuu`;
const MISA_REFERER = `${MISA_TRA_CUU}/`;

/** Header "điều hướng iframe" — thiếu là DownloadHandler trả body rỗng (xem đầu file). */
const MISA_IFRAME_HEADERS: Record<string, string> = {
  referer: MISA_REFERER,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "sec-fetch-dest": "iframe",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

export const misa: ProviderDownloader = {
  mst: "0101243150",
  ten: "MISA",
  async download({ code }) {
    // Bước 1: mint token ext (toàn cục theo thời gian; vẫn gửi `code` cho giống trình duyệt).
    const ext = await mintTokenForm({
      url: `${MISA_TRA_CUU}/GetRequestTimeEnCode`,
      body: `code=${encodeURIComponent(code)}`,
      headers: { referer: MISA_REFERER, origin: MISA_ORIGIN, "x-requested-with": "XMLHttpRequest" },
      pick: (json) => {
        const o = json as { success?: boolean; data?: string } | null;
        return o?.success ? o.data : undefined;
      },
      ten: "MISA",
    });

    // Bước 2: tải file PDF với token vừa mint + header iframe.
    const url =
      `${MISA_TRA_CUU}/tra-cuu/DownloadHandler.ashx` +
      `?Type=pdf&Viewer=1&ext=${encodeURIComponent(ext)}&Code=${encodeURIComponent(code)}`;
    return fetchFileGoc({ url, headers: MISA_IFRAME_HEADERS, code, ten: "MISA" });
  },
};

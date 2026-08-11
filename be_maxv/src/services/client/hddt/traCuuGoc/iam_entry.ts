/**
 * ===== NỀN TẢNG "iam-entry" (Moqui ERP) — dùng chung cho nhiều NCC =====
 *
 * My Software (`tracuu.myinvoice.vn`) và VININVOICE (`tracuu.vininvoice.vn`) chạy CÙNG một phần mềm
 * tra cứu, khác nhau đúng cái origin. Đã đối chiếu trên cả hai cổng thật: cùng đường dẫn REST, cùng
 * hình dạng response, cùng hình dạng lỗi. Vì vậy bộ tải là MỘT hàm tạo, mỗi NCC chỉ khai origin.
 *
 * LUỒNG 1 REQUEST:
 *   GET <origin>/erp/rest/s1/iam-entry/invoices/<mã tra cứu>/pdf  ->  bytes PDF
 *
 * Không captcha, không cookie, không token — mã tra cứu đi thẳng vào path.
 *
 * BỎ `?v=0` trong URL trình duyệt: đã đo, có hay không cho ra byte-for-byte cùng một file
 * (329.787 byte). Nó là tham số cache-busting của trang, không phải tham số nghiệp vụ.
 *
 * BỎ LUÔN BƯỚC KIỂM `/header-info` mà bản đầu của `ms_invoice.ts` gọi trước khi tải: `/pdf` TỰ báo mã
 * sai bằng 400 + JSON (đã kiểm trên cả hai cổng), nên bước đó chỉ nhân đôi số request lên cổng NCC mà
 * không thêm thông tin gì. Một lượt tải là hàng chục hóa đơn nên khoản đó không nhỏ.
 *
 * MÃ SAI -> HTTP 400 + `{"errorCode":400,"errors":"Không tìm thấy hóa đơn hoặc hóa đơn đã bị xóa\n"}`.
 * Câu `errors` là TIẾNG VIỆT sẵn sàng đưa cho kế toán đọc, nên ném kèm nguyên văn.
 */

import {
  NAVIGATE_HEADERS,
  dispatcherThemCa,
  fetchUpstream,
  laPdf,
  pdfFromResponse,
} from "./shared";
import { FileHoaDonGoc, ProviderDownloader, TraCuuGocError } from "./types";

/** Đường dẫn REST cố định của nền tảng — phần khác nhau giữa các NCC chỉ là origin đứng trước. */
const REST_PATH = "/erp/rest/s1/iam-entry/invoices";

/**
 * Rút câu thông báo tiếng Việt trong body lỗi JSON của cổng. Rỗng nếu body không phải JSON hoặc
 * không có `errors` — nơi gọi tự có câu dự phòng.
 */
function rutLoi(raw: string): string {
  try {
    const json = JSON.parse(raw) as { errors?: unknown };
    return typeof json.errors === "string" ? json.errors.trim() : "";
  } catch {
    return "";
  }
}

/**
 * Tạo bộ tải cho 1 NCC chạy nền tảng iam-entry.
 *
 * @param mst   MST NCC phát hành — khóa dispatcher, khớp registry `TRA_CUU_NCC` bên FE.
 * @param ten   Tên NCC dùng trong thông báo lỗi.
 * @param origin Origin cổng tra cứu, không có dấu `/` cuối (vd `https://tracuu.vininvoice.vn`).
 * @param caBoSung PEM của CA trung gian phải TỰ THÊM vì cổng gửi thiếu — xem `dispatcherThemCa`.
 *   Dựng Agent MỘT LẦN lúc tạo bộ tải, không phải mỗi hóa đơn: Agent là pool kết nối, tạo lại theo
 *   từng request là vứt hết TLS session và bắt tay lại từ đầu cho mỗi hóa đơn trong lô.
 */
export function taoBoTaiIamEntry(opts: {
  mst: string;
  ten: string;
  origin: string;
  caBoSung?: string;
}): ProviderDownloader {
  const { mst, ten, origin, caBoSung } = opts;
  const dispatcher = caBoSung ? dispatcherThemCa(caBoSung) : undefined;

  return {
    mst,
    ten,
    // Trang tra cứu thủ công của nền tảng này luôn là SPA ở gốc origin.
    urlTraCuu: `${origin}/#/`,
    async download({ code }): Promise<FileHoaDonGoc> {
      const res = await fetchUpstream(
        `${origin}${REST_PATH}/${encodeURIComponent(code)}/pdf`,
        {
          headers: {
            ...NAVIGATE_HEADERS,
            accept: "application/pdf,application/octet-stream,*/*",
            referer: `${origin}/`,
          },
          dispatcher,
        },
        ten,
      );

      if (!res.ok) {
        const loi = rutLoi(await res.text().catch(() => ""));
        // 4xx = cổng đã xét mã và từ chối -> DỨT KHOÁT, thử lại vô ích. 5xx = sự cố cổng -> đáng quét lại.
        if (res.status < 500) {
          throw new TraCuuGocError(
            "INVALID_CODE",
            loi
              ? `${ten}: ${loi}`
              : `Không tìm thấy hóa đơn gốc ${ten} cho mã "${code}" (mã sai hoặc đã hết hạn tra cứu)`,
          );
        }
        throw new TraCuuGocError(
          "UPSTREAM",
          `${ten} trả lỗi khi tải file (HTTP ${res.status})${loi ? ` — ${loi}` : ""}`,
          true,
        );
      }

      // `maDaXacThuc: false` — mã tra cứu đi THẲNG vào URL, không qua bước đổi lấy token nào, nên body
      // rỗng ở đây nghĩa là mã sai chứ không phải token vừa hết hạn.
      const file = await pdfFromResponse(res, code, ten);
      // Soi MAGIC BYTES chứ không tin `content-type`: mã sai đã bị 400 chặn ở trên rồi, nên 200 mà
      // không phải PDF là cổng đang trục trặc -> đáng thử lại, đừng giao file rác cho kế toán.
      if (!laPdf(file.buffer)) {
        throw new TraCuuGocError(
          "UPSTREAM",
          `${ten} không trả file PDF cho mã "${code}" — thử lại`,
          true,
        );
      }
      return file;
    },
  };
}

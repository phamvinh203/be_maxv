/**
 * ===== TẢI HÓA ĐƠN GỐC — M-INVOICE (tracuuhoadon.minvoice.com.vn) =====
 *
 * MỘT request GET, không captcha, không cookie, không token:
 *
 *   GET /api/Search/SearchInvoice?masothue=<nbmst>&sobaomat=<mã>&type=PDF&inchuyendoi=false
 *     -> bytes PDF
 *
 * KHÁC các NCC còn lại: mã tra cứu KHÔNG tự định danh được hóa đơn — phải đi kèm MST NGƯỜI BÁN
 * (`masothue`). Vì vậy `canSellerMst: true`; dispatcher chặn sẵn ca thiếu.
 *
 * ⚠️ `type=PDF` BẮT BUỘC — bỏ đi thì cổng trả `400 {"errors":{"type":["The type field is required."]}}`.
 *
 * ⚠️ `inchuyendoi=false` thì KHÔNG bắt buộc (bỏ đi vẫn ra đúng file, đã đo) nhưng VẪN GỬI: đây là cờ
 * "in chuyển đổi" — bản PDF có đóng dấu HÓA ĐƠN CHUYỂN ĐỔI, một tờ khác về mặt pháp lý. Dựa vào giá
 * trị mặc định của cổng nghĩa là ngày họ đổi mặc định thì kế toán lặng lẽ nhận nhầm loại hóa đơn.
 *
 * `accept: application/json` trong curl của trình duyệt là thừa — cổng trả `application/pdf` bất kể.
 *
 * TLS: chuỗi chứng chỉ của cổng này ĐẦY ĐỦ (`Verify return code: 0`), không phải vá CA như VININVOICE.
 */

import {
  assertMst,
  fetchUpstream,
  khopCum,
  laPdf,
  makeDbg,
  pdfFromResponse,
} from "./shared";
import { ProviderDownloader, TraCuuGocError } from "./types";

const TEN = "M-INVOICE";

/** MST NCC phát hành — khớp entry `0106026495` trong registry FE `TRA_CUU_NCC`. */
const MINVOICE_MST = "0106026495";

const ORIGIN = "https://tracuuhoadon.minvoice.com.vn";
/** Trang tra cứu thủ công — cũng là `referer` mà luồng tải giả lập. */
const TRA_CUU_URL = `${ORIGIN}/tra-cuu-hoa-don`;
const SEARCH_PATH = "/api/Search/SearchInvoice";

/** Debug logger — bật bằng `DEBUG_MINVOICE=1` khi cổng đổi DTO/luồng. */
const dbg = makeDbg("MINVOICE-DBG", "DEBUG_MINVOICE");

/**
 * Câu M-INVOICE trả khi cặp (MST, số bảo mật) không tra ra hóa đơn — LẤY TỪ RESPONSE THẬT:
 *   GET …&sobaomat=KHONGCOTHAT00000  ->  500
 *   {"code":"5000","message":"Thông tin tra cứu không chính xác, vui lòng kiểm tra lại Mã số thuế
 *    và Số bảo mật.\n", …}
 *
 * Cổng dùng **500 cho cả lỗi nghiệp vụ lẫn sự cố thật**, nên KHÔNG thể phân loại bằng status. Phải dò
 * theo câu chữ:
 *  - khớp cụm dưới đây -> `INVALID_CODE` (422, dứt khoát, FE không quét lại);
 *  - 5xx còn lại       -> `UPSTREAM` + `retryable`, nghiêng về phía thử lại vì đoán nhầm hướng này chỉ
 *    tốn vài lượt, còn đoán nhầm hướng kia thì bỏ oan hóa đơn vốn tra được.
 */
const LOI_SAI_MA = ["thông tin tra cứu không chính xác"];

/**
 * Rút `message` trong body lỗi JSON. Rỗng nếu không phải JSON hoặc không có trường đó.
 *
 * CHỈ dùng để PHÂN LOẠI, không ném thẳng ra ngoài: khi `masothue` trỏ tới tenant không tồn tại, cổng
 * nhét nguyên một stack trace .NET vào chính trường này ("An error occurred when trying to create a
 * controller of type 'TraCuuController'…"). Đưa cái đó cho kế toán đọc thì vừa vô nghĩa vừa lộ chi
 * tiết nội bộ của NCC — nên chỉ câu tiếng Việt đã nhận diện được mới được hiển thị.
 */
function rutMessage(raw: string): string {
  try {
    const json = JSON.parse(raw) as { message?: unknown };
    return typeof json.message === "string" ? json.message.trim() : "";
  } catch {
    return "";
  }
}

/**
 * Bộ tải M-INVOICE. `code` = **số bảo mật** in trên hóa đơn (vd `7BF5633A329E0554`); FE rút từ
 * `cttkhac` của payload chi tiết — xem `TRA_CUU_NCC`.
 */
export const minvoice: ProviderDownloader = {
  mst: MINVOICE_MST,
  ten: TEN,
  canSellerMst: true,
  urlTraCuu: TRA_CUU_URL,
  async download({ code, sellerMst }) {
    const params = new URLSearchParams({
      // `sellerMst!`: `canSellerMst` đã bắt dispatcher chặn ca thiếu trước khi vào đây.
      masothue: assertMst(sellerMst!, TEN),
      sobaomat: code,
      type: "PDF",
      inchuyendoi: "false",
    });

    const res = await fetchUpstream(
      `${ORIGIN}${SEARCH_PATH}?${params}`,
      {
        headers: {
          accept: "application/pdf,application/json,*/*",
          referer: TRA_CUU_URL,
        },
      },
      TEN,
    );

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      dbg("SearchInvoice lỗi", { status: res.status, raw });
      const message = rutMessage(raw);
      if (khopCum(message, LOI_SAI_MA)) {
        throw new TraCuuGocError("INVALID_CODE", `${TEN}: ${message}`);
      }
      throw new TraCuuGocError(
        "UPSTREAM",
        `${TEN} trả lỗi khi tải file (HTTP ${res.status})` +
          " — bật DEBUG_MINVOICE=1 rồi xem log `SearchInvoice lỗi`",
        res.status >= 500,
      );
    }

    // `maDaXacThuc: false` — mã đi THẲNG vào query, không qua bước đổi lấy token nào, nên body rỗng ở
    // đây nghĩa là mã sai chứ không phải token vừa hết hạn.
    const file = await pdfFromResponse(res, code, TEN);
    // Soi MAGIC BYTES chứ không tin `content-type`: ca mã sai đã bị chặn ở trên, nên 200 mà không phải
    // PDF là cổng đang trục trặc -> đáng thử lại, đừng giao file rác cho kế toán.
    if (!laPdf(file.buffer)) {
      throw new TraCuuGocError("UPSTREAM", `${TEN} không trả file PDF cho mã "${code}" — thử lại`, true);
    }
    return file;
  },
};

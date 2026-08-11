/**
 * ===== TẢI HÓA ĐƠN GỐC — FAST (einvoice.fast.com.vn) =====
 *
 * MỘT request GET, không captcha, không cookie, không session:
 *
 *   GET /AppHandler/EInvoiceQuery.ashx?p=<base64(KeySearch)>&t=4   ->   bytes PDF
 *
 * `p` LÀ BASE64 CỦA CHÍNH `KeySearch` — không phải một mã riêng nào khác. Đã đối chiếu: giải base64
 * tham số `p` trong URL của trình duyệt ra đúng chuỗi `KeySearch` nằm trong `ttkhac` của payload chi
 * tiết (`AQAAANOSZdQ…5ag=000614`). Vì vậy provider tự mã hóa, FE chỉ cần đưa `KeySearch` thô.
 *
 * BỎ 3 THAM SỐ CÓ TRONG URL TRÌNH DUYỆT — đã đo từng cái trên cổng thật:
 *   `c=sT1`  ⚠️ PHẢI BỎ. Có nó thì cổng trả 200 kèm BODY RỖNG (0 byte). Nó tham chiếu state phía
 *            server của phiên đang mở trên web; gọi từ ngoài phiên đó là hỏng. Đây là tham số DUY
 *            NHẤT làm sai kết quả, nên đừng "chép cho giống trình duyệt" rồi thêm lại.
 *   `n=1576` bỏ được (có hay không đều ra đúng file).
 *   `r=…`    bỏ được — chỉ là số chống cache theo epoch ms.
 *
 * `t=4` THÌ BẮT BUỘC và phải đúng bằng 4: `t=1` cho ra body rỗng, thiếu `t` cũng rỗng.
 *
 * KHÔNG DÙNG `POST /index.aspx/GetData`: nó trả về một ảnh PNG base64 100×30 — CAPTCHA của form tra
 * cứu thủ công trên web. Luồng này đi thẳng vào `EInvoiceQuery.ashx` bằng `KeySearch` nên không chạm
 * tới form, không cần giải captcha. Cookie `FasteInvoice.SessionId`/`ARRAffinity` cũng vậy: đã thử
 * gọi hoàn toàn KHÔNG cookie, vẫn ra đúng file.
 *
 * MÃ SAI -> 302 sang `/Error.htm`, xem `download` bên dưới.
 *
 * TLS: chuỗi chứng chỉ của cổng này ĐẦY ĐỦ (`Verify return code: 0`), không phải vá CA như VININVOICE.
 */

import { fetchUpstream, laPdf, pdfFromResponse } from "./shared";
import { ProviderDownloader, TraCuuGocError } from "./types";

const TEN = "FAST";

/** MST NCC phát hành — khớp entry `0100727825` trong registry FE `TRA_CUU_NCC`. */
const FAST_MST = "0100727825";

const ORIGIN = "https://einvoice.fast.com.vn";
/** Trang tra cứu thủ công — cũng là `referer` mà luồng tải giả lập. */
const TRA_CUU_URL = `${ORIGIN}/`;
const QUERY_PATH = "/AppHandler/EInvoiceQuery.ashx";

/** Kiểu file muốn lấy. `4` = PDF; giá trị khác cho ra body rỗng chứ không báo lỗi. */
const LOAI_FILE_PDF = "4";

/**
 * Bộ tải FAST. `code` = `KeySearch` in trong `ttkhac` của hóa đơn (FE rút bằng
 * `maTraCuu: { src: "ttkhac", ttruong: "KeySearch" }` — xem `TRA_CUU_NCC`). KHÔNG cần `sellerMst`.
 */
export const fast: ProviderDownloader = {
  mst: FAST_MST,
  ten: TEN,
  urlTraCuu: TRA_CUU_URL,
  async download({ code }) {
    // `URLSearchParams` lo phần escape: base64 có thể chứa `+` và `/`, để thô thì `+` bị hiểu thành
    // dấu cách. Đã kiểm cổng decode percent-encoding đúng (gửi `%51` thay `Q` vẫn ra cùng file).
    const params = new URLSearchParams({
      p: Buffer.from(code, "utf8").toString("base64"),
      t: LOAI_FILE_PDF,
    });

    const res = await fetchUpstream(
      `${ORIGIN}${QUERY_PATH}?${params}`,
      {
        headers: {
          accept: "application/pdf,text/html,*/*",
          referer: TRA_CUU_URL,
        },
        // Bắt 302 thay vì đi theo — xem nhánh xử lý ngay dưới.
        redirect: "manual",
      },
      TEN,
    );

    // Mã sai -> ASP.NET đá sang trang lỗi chung: `302 Location: /Error.htm?aspxerrorpath=…`.
    //
    // Xếp DỨT KHOÁT (`INVALID_CODE`, không thử lại) dù trang lỗi đó không nói gì cụ thể: đã thử 3 kiểu
    // mã hỏng (base64 rác, đổi số cuối, đổi 1 ký tự trong key) và cả 3 đều ra ĐÚNG redirect này, tức
    // đây chính là cách FAST nói "không có hóa đơn". Quan trọng hơn, 302 nghĩa là ứng dụng vẫn SỐNG và
    // đã xét mã rồi mới từ chối — cổng chết thì `fetchUpstream` đã ném `UPSTREAM` từ tầng mạng, hoặc
    // trả 5xx, chứ không redirect gọn gàng thế này.
    if (res.status >= 300 && res.status < 400) {
      throw new TraCuuGocError(
        "INVALID_CODE",
        `Không tìm thấy hóa đơn gốc ${TEN} cho mã "${code}" (mã sai hoặc đã hết hạn tra cứu)`,
      );
    }
    if (!res.ok) {
      throw new TraCuuGocError(
        "UPSTREAM",
        `${TEN} trả lỗi khi tải file (HTTP ${res.status})`,
        // 5xx = sự cố cổng, đáng để FE quét lại; 4xx thì thử lại vô ích.
        res.status >= 500,
      );
    }

    // `maDaXacThuc: false` — `KeySearch` đi THẲNG vào URL, không qua bước đổi lấy token nào, nên body
    // rỗng ở đây nghĩa là mã sai chứ không phải token vừa hết hạn. Body rỗng cũng đúng là thứ cổng trả
    // khi tham số sai (xem docblock đầu file), nên bẫy này là chốt chặn thật chứ không phải phòng xa.
    const file = await pdfFromResponse(res, code, TEN);
    // Soi MAGIC BYTES chứ không tin `content-type`: 200 mà không phải PDF là cổng đang trục trặc.
    if (!laPdf(file.buffer)) {
      throw new TraCuuGocError("UPSTREAM", `${TEN} không trả file PDF cho mã "${code}" — thử lại`, true);
    }
    return file;
  },
};

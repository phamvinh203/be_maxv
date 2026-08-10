import {
  NAVIGATE_HEADERS,
  fetchUpstream,
  khopCum,
  pdfFromResponse,
  pdfTuGoi,
} from "./shared";
import { ProviderDownloader, TraCuuGocError } from "./types";

const TEN = "VETC";
const VETC_MST = "0107500414";
const ORIGIN = "https://tracuuhoadon.vetc.com.vn";
const TRA_CUU_URL = `${ORIGIN}/`;
const DOWNLOAD_PATH = "/download";

const LOI_KHONG_CO_FILE = ["ioerror writing file to output stream"];


export const vetc: ProviderDownloader = {
  mst: VETC_MST,
  ten: TEN,
  urlTraCuu: TRA_CUU_URL,
  async download({ code }) {
    const res = await fetchUpstream(
      `${ORIGIN}${DOWNLOAD_PATH}/${encodeURIComponent(code)}`,
      {
        headers: {
          ...NAVIGATE_HEADERS,
          referer: TRA_CUU_URL,
        },
      },
      TEN,
    );

    if (!res.ok) {
      // Đọc body để phân biệt "không có hóa đơn" với sự cố thật — xem `LOI_KHONG_CO_FILE`.
      const raw = await res.text().catch(() => "");
      if (res.status >= 500 && khopCum(raw, LOI_KHONG_CO_FILE)) {
        throw new TraCuuGocError(
          "INVALID_CODE",
          `Không tìm thấy hóa đơn gốc ${TEN} cho mã "${code}" (mã sai hoặc đã hết hạn tra cứu)`,
        );
      }
      throw new TraCuuGocError(
        "UPSTREAM",
        `${TEN} trả lỗi khi tải file (HTTP ${res.status})`,
        // 5xx lạ = sự cố cổng, đáng để FE quét lại; 4xx thì thử lại vô ích.
        res.status >= 500,
      );
    }

    // `maDaXacThuc: false` — `secureId` đi THẲNG vào URL tải, không qua bước đổi lấy token nào, nên
    // body rỗng ở đây nghĩa là mã sai chứ không phải token vừa hết hạn.
    const goi = await pdfFromResponse(res, code, TEN);
    // Cổng gói `ATIS_<số hóa đơn>.zip` gồm PDF + XML + HTML; chỉ PDF ra khỏi module này.
    return pdfTuGoi(goi, code, TEN);
  },
};

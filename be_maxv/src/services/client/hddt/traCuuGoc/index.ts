/**
 * ===== DISPATCHER: TẢI HÓA ĐƠN GỐC THEO NCC PHÁT HÀNH =====
 *
 * Điểm vào duy nhất cho controller. Chọn bộ tải theo `msttcgp` (MST NCC phát hành — khóa của registry
 * `TRA_CUU_NCC` bên FE).
 *
 * THÊM NCC MỚI: viết 1 file `<ncc>.ts` export một `ProviderDownloader` rồi thêm vào mảng `REGISTRY`
 * bên dưới — không phải sửa gì khác. NCC chưa đăng ký -> `UNSUPPORTED` (501).
 */

import { misa } from "./misa";
import { easyInvoice } from "./easy_invoice";
import { fast } from "./fast";
import { minvoice } from "./minvoice";
import { msInvoice } from "./ms_invoice";
import { vetc } from "./vetc";
import { vinInvoice } from "./vin_invoice";
import { viettel } from "./vinvoice_viettel";
import { vpt } from "./vnpt";
import { cyberlotus } from "./xcyber";
import { DownloadRequest, FileHoaDonGoc, ProviderDownloader, TraCuuGocError } from "./types";

/** Danh sách bộ tải đã có. Thêm NCC mới = thêm 1 phần tử ở đây. */
const REGISTRY: ProviderDownloader[] = [
  misa,
  viettel,
  vpt,
  msInvoice,
  cyberlotus,
  easyInvoice,
  vetc,
  vinInvoice,
  minvoice,
  fast,
];

const BY_MST = new Map(REGISTRY.map((p) => [p.mst, p]));

/** 1 NCC trong danh mục trả cho FE. */
export interface NhaCungCapTraCuu {
  /** MST NCC phát hành — khóa ghép với `msttcgp` của hóa đơn. */
  msttcgp: string;
  ten: string;
  /** URL trang tra cứu thủ công; `{mst}` = chỗ điền MST người bán. Xem `ProviderDownloader.urlTraCuu`. */
  urlTraCuu: string;
}

export interface DanhMucTraCuuGoc {
  /** NCC có bộ tải TỰ ĐỘNG. FE dựng nút "Tải hóa đơn gốc" từ đây. */
  nccs: NhaCungCapTraCuu[];
  /**
   * MST người bán -> URL tra cứu đã DÒ được, ghi đè `urlTraCuu` của NCC tương ứng.
   *
   * BEST-EFFORT và theo TIẾN TRÌNH: rỗng sau mỗi lần restart BE, chỉ có dữ liệu cho những người bán
   * đã từng tải hóa đơn gốc thành công trong tiến trình này. FE luôn phải có đường lùi về `urlTraCuu`.
   */
  urlDaDo: Record<string, string>;
}

/**
 * Danh mục NCC cho FE — nguồn DUY NHẤT để FE biết NCC nào tải tự động được và link tra cứu thủ công
 * là gì.
 *
 * Có endpoint này vì trước đây FE giữ một bản sao chép tay của `REGISTRY` (cờ `taiTuDong` + URL cổng
 * NCC). Hai bản lệch nhau mỗi khi deploy lệch phiên bản, và FE đã phải mang một nhánh xử-lý-501 riêng
 * để che triệu chứng đó.
 */
export function danhMucTraCuuGoc(): DanhMucTraCuuGoc {
  const urlDaDo: Record<string, string> = {};
  for (const p of REGISTRY) Object.assign(urlDaDo, p.urlTraCuuTheoMst?.());

  return {
    nccs: REGISTRY.map((p) => ({ msttcgp: p.mst, ten: p.ten, urlTraCuu: p.urlTraCuu })),
    urlDaDo,
  };
}

/**
 * Tải file PDF gốc 1 hóa đơn theo NCC phát hành.
 * @param msttcgp MST NCC phát hành (vd MISA = "0101243150", Viettel = "0100109106").
 * @param req     Dữ liệu hóa đơn (mã tra cứu + MST người bán + token captcha nếu NCC cần).
 */
export async function taiHoaDonGoc(msttcgp: string, req: DownloadRequest): Promise<FileHoaDonGoc> {
  const provider = BY_MST.get(msttcgp);
  if (!provider) {
    throw new TraCuuGocError(
      "UNSUPPORTED",
      `Chưa hỗ trợ tải hóa đơn gốc cho NCC có MST ${msttcgp || "(trống)"}`,
    );
  }
  // Kiểm ĐIỀU KIỆN ĐẦU VÀO của provider ở đây, cùng chỗ với kiểm "có provider không" — provider chỉ
  // khai `canSellerMst`, không phải tự viết guard (xem docblock của cờ đó).
  if (provider.canSellerMst && !req.sellerMst) {
    throw new TraCuuGocError(
      "INVALID_CODE",
      `Thiếu MST người bán (nbmst) — ${provider.ten} cần MST này để tra cứu hóa đơn`,
    );
  }
  return provider.download(req);
}

export { TraCuuGocError } from "./types";
export type { DownloadRequest, FileHoaDonGoc, ProviderDownloader } from "./types";

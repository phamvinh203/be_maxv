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
import { msInvoice } from "./ms_invoice";
import { viettel } from "./vinvoice_viettel";
import { vpt } from "./vnpt";
import { cyberlotus } from "./xcyber";
import { DownloadRequest, FileHoaDonGoc, ProviderDownloader, TraCuuGocError } from "./types";

/** Danh sách bộ tải đã có. Thêm NCC mới = thêm 1 phần tử ở đây. */
const REGISTRY: ProviderDownloader[] = [misa, viettel, vpt, msInvoice, cyberlotus];

const BY_MST = new Map(REGISTRY.map((p) => [p.mst, p]));

/** MST các NCC đã hỗ trợ tải tự động — để nơi khác đối chiếu nếu cần. */
export const SUPPORTED_MST: string[] = REGISTRY.map((p) => p.mst);

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
  return provider.download(req);
}

export { TraCuuGocError } from "./types";
export type { DownloadRequest, FileHoaDonGoc, ProviderDownloader } from "./types";

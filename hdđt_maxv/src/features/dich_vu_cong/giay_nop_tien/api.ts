import { apiFetch, apiFetchBlob } from "../../../lib/http";
import { qsBoQuaRong, type DvcBangHoSo } from "../api/dvc";

export interface DvcGntTraCuuParams {
  /** `yyyy-mm-dd`. */
  tuNgay?: string;
  denNgay?: string;
  maGiaoDich?: string;
  soGnt?: string;
}

/**
 * GET /api/v1/dvc/giay-nop-tien → `{ headers, rows }` — cùng hình dạng `DvcBangHoSo`, đọc thẳng dữ
 * liệu đã đồng bộ. Dùng: `DvcPage` (tra cứu tab "Giấy nộp tiền").
 */
export async function traCuuGiayNopTienDvc(params: DvcGntTraCuuParams): Promise<DvcBangHoSo> {
  return apiFetch<DvcBangHoSo>(`/dvc/giay-nop-tien?${qsBoQuaRong(params).toString()}`);
}

export interface DvcGntFileParams {
  /** Khóa phiên — CHỈ cần khi GNT chưa từng tải file (cache miss), cùng quy ước `DvcHoSoDaDongBoParams`. */
  key?: string;
  /** "Số tham chiếu / Mã giao dịch" của dòng — khớp PK `dvc_giay_nop_tien.so_tham_chieu`. */
  maGiaoDich: string;
}

/**
 * GET /api/v1/dvc/giay-nop-tien/file → tải PDF một Giấy nộp tiền, qua BE proxy. Dùng: cột "Tải
 * file" tab "Giấy nộp tiền".
 */
export function taiFileGiayNopTienDvc({ key, maGiaoDich }: DvcGntFileParams): Promise<Blob> {
  return apiFetchBlob(`/dvc/giay-nop-tien/file?${qsBoQuaRong({ key, maGiaoDich }).toString()}`);
}

import { taiFileGiayNopTienDvc } from "./api";
import { luuVeMay } from "../../../lib/downloadFile";
import { duoiTuContentType } from "../duoiTuContentType";

/**
 * Tải PDF của một Giấy nộp tiền về máy — nguồn cho icon cột "Tải file" ở `BangHoSo` khi đang mở
 * tab "Giấy nộp tiền". `maGiaoDich` là "Số tham chiếu / Mã giao dịch" của dòng đang bấm (PK
 * `dvc_giay_nop_tien.so_tham_chieu`).
 */
export async function taiFileGiayNopTien(key: string | null, maGiaoDich: string): Promise<void> {
  const blob = await taiFileGiayNopTienDvc({ key: key ?? undefined, maGiaoDich });
  const duoi = duoiTuContentType(blob.type, "pdf");
  luuVeMay(blob, `${maGiaoDich}.${duoi}`);
}

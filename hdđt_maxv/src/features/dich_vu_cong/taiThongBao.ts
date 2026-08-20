import { taiThongBaoDvc } from "./api/dvc";
import { luuVeMay } from "../../lib/downloadFile";
import { duoiTuContentType } from "./duoiTuContentType";

/**
 * Tải file của một thông báo về máy — nguồn cho nút tải trong `ThongBaoDialog`.
 *
 * `key` là TÙY CHỌN (`null` = chưa đăng nhập cổng): BE đọc cache trong DB trước, chỉ cần `key`
 * khi thông báo chưa được tải/đồng bộ trước đó.
 */
export async function taiThongBao(
  key: string | null,
  maHoSo: string,
  idTbao: string,
): Promise<void> {
  const blob = await taiThongBaoDvc({ key: key ?? undefined, maHoSo, idTbao });
  const duoi = duoiTuContentType(blob.type, "xml");
  luuVeMay(blob, `thong-bao-${idTbao}.${duoi}`);
}

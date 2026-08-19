import { taiThongBaoDvc } from "./api/dvc";
import { luuVeMay } from "../../lib/downloadFile";
import { duoiTuContentType } from "./duoiTuContentType";

/**
 * Tải file của một thông báo về máy — nguồn cho nút tải trong `ThongBaoDialog`.
 */
export async function taiThongBao(key: string, maHoSo: string, idTbao: string): Promise<void> {
  const blob = await taiThongBaoDvc({ key, maHoSo, idTbao });
  const duoi = duoiTuContentType(blob.type, "xml");
  luuVeMay(blob, `thong-bao-${idTbao}.${duoi}`);
}

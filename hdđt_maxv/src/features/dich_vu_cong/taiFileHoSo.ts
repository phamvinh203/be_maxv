import { taiFileHoSoDvc } from "./api/dvc";
import { luuVeMay } from "../../lib/downloadFile";
import { duoiTuContentType } from "./duoiTuContentType";

/**
 * Tải file XML của một hồ sơ Dịch vụ công về máy — nguồn cho icon cột "Tải file" ở
 * `BangHoSo`.
 *
 * `maHoSo` là giá trị đã bóc từ cột "Mã giao dịch" của dòng đang bấm (tên thật bên cổng là
 * "Mã hồ sơ", xem `srcHeader` trong `config.ts`).
 */
export async function taiFileHoSo(key: string, maHoSo: string): Promise<void> {
  const blob = await taiFileHoSoDvc({ key, maHoSo });
  const duoi = duoiTuContentType(blob.type, "xml");
  luuVeMay(blob, `${maHoSo}.${duoi}`);
}

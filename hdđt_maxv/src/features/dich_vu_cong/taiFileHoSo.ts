import { taiFileHoSoDvc } from "./api/dvc";
import { luuVeMay } from "../../lib/downloadFile";
import { duoiTuContentType } from "./duoiTuContentType";

/**
 * Tải file XML của một hồ sơ Dịch vụ công về máy — nguồn cho icon cột "Tải file" ở
 * `BangHoSo`.
 *
 * `maHoSo` là giá trị đã bóc từ cột "Mã giao dịch" của dòng đang bấm (tên thật bên cổng là
 * "Mã hồ sơ", xem `srcHeader` trong `config.ts`).
 *
 * `key` là TÙY CHỌN (`null` = chưa đăng nhập cổng): BE đọc cache trong DB trước, chỉ cần `key`
 * khi hồ sơ chưa được đồng bộ — xem `DvcHoSoDaDongBoParams`.
 */
export async function taiFileHoSo(key: string | null, maHoSo: string): Promise<void> {
  const blob = await taiFileHoSoDvc({ key: key ?? undefined, maHoSo });
  const duoi = duoiTuContentType(blob.type, "xml");
  luuVeMay(blob, `${maHoSo}.${duoi}`);
}

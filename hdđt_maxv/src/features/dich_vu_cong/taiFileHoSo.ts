import { taiFileHoSoDvc } from "./api/dvc";
import { luuVeMay } from "../../lib/downloadFile";

/** Đuôi file suy từ content-type cổng trả về — mặc định `.xml` vì đây luôn là file tờ khai XML. */
const DUOI_THEO_CONTENT_TYPE: Record<string, string> = {
  "text/xml": "xml",
  "application/xml": "xml",
  "application/pdf": "pdf",
  "application/zip": "zip",
};

/**
 * Tải file XML của một hồ sơ Dịch vụ công về máy — nguồn cho icon cột "Tải file" ở
 * `BangHoSo`.
 *
 * `maHoSo` là giá trị đã bóc từ cột "Mã giao dịch" của dòng đang bấm (tên thật bên cổng là
 * "Mã hồ sơ", xem `srcHeader` trong `config.ts`).
 */
export async function taiFileHoSo(key: string, maHoSo: string): Promise<void> {
  const blob = await taiFileHoSoDvc({ key, maHoSo });
  const duoi = DUOI_THEO_CONTENT_TYPE[blob.type] ?? "xml";
  luuVeMay(blob, `${maHoSo}.${duoi}`);
}

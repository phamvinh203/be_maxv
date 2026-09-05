/**
 * Truy vấn dữ liệu phục vụ đối soát tờ khai.
 *
 * Các quy tắc sinh cảnh báo vẫn nằm ở `soatToKhai.ts` (hàm thuần); file này chỉ biết cách đọc
 * chứng cứ từ tenant DB. Tách như vậy để application service không phải mang SQL đối soát.
 */
import type { PrismaClient } from "../../../../generated/tenant";
import type { ThayTheHut } from "../domain/soatToKhai";
import { tenViewHoaDon, type Chieu } from "../domain/chieuHoaDon";
import type { Ky } from "../domain/kySoThue";

/** Hóa đơn thay thế có tổng nhỏ hơn hóa đơn gốc, dấu hiệu có thể bỏ sót dòng hàng. */
export async function layThayTheHut(
  db: PrismaClient,
  ky: Ky,
  chieu: Chieu,
): Promise<ThayTheHut[]> {
  const view = tenViewHoaDon(chieu);
  return db.$queryRawUnsafe<ThayTheHut[]>(
    `SELECT m.khhdon || '|' || m.shdon AS "hoaDon",
            g.shdon                    AS "soGoc",
            (g.tgtcthue - m.tgtcthue)::float8 AS hut
       FROM "tokhai_ky_hoa_don" k
       JOIN "${view}" m ON m.id = k.hoa_don_id
       JOIN "${view}" g
         ON g.khhdon = m.detail->>'khhdgoc' AND g.shdon = m.detail->>'shdgoc'
      WHERE k.chieu = $1 AND k.nam = $2 AND k.ky_loai = $3 AND k.ky_so = $4
        AND k.ke_khai AND m.tthai = '2' AND m.tgtcthue < g.tgtcthue
      ORDER BY (g.tgtcthue - m.tgtcthue) DESC`,
    chieu,
    ky.nam,
    ky.kyLoai,
    ky.kySo,
  );
}

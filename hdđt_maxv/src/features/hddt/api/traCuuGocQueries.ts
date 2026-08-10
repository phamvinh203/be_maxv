import { useQuery } from "@tanstack/react-query";
import { getDanhMucTraCuuGoc } from "./traCuuGoc";

/**
 * Danh mục NCC tra cứu hóa đơn gốc. KHÔNG gắn MST công ty vào key: danh mục là thuộc tính của các
 * cổng NCC ngoài kia, giống nhau với mọi tenant.
 */
export const danhMucTraCuuGocKey = ["danhMucTraCuuGoc"] as const;

/**
 * Danh mục NCC + URL tra cứu, dùng cho bảng Chi tiết (cột "URL tra cứu"), sheet Excel và dialog
 * "Tải hóa đơn gốc".
 *
 * `staleTime` NGẮN vì `urlDaDo` LỚN DẦN theo các lượt tải: BE chỉ biết domain thật của một người bán
 * sau khi đã dò thành công một lần. `DownloadOriginalDialog` còn invalidate thẳng sau mỗi lượt tải
 * nên link được sửa ngay, `staleTime` ở đây chỉ là lưới đỡ cho các màn hình khác.
 */
export function useDanhMucTraCuuGocQuery() {
  return useQuery({
    queryKey: danhMucTraCuuGocKey,
    queryFn: getDanhMucTraCuuGoc,
    staleTime: 60_000,
  });
}

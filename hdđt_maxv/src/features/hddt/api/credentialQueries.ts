import { useQuery } from "@tanstack/react-query";
import { getGdtSavedPassword } from "./gdt";

/**
 * Mật khẩu cổng thuế đã lưu của công ty đang chọn. Server suy theo MST công ty đang chọn (JWT), nên
 * key gắn `mst` để đổi công ty là tự nạp lại. Dùng: `DialogLoginHddt` (điền sẵn ô mật khẩu).
 */
export const gdtSavedPasswordKey = (mst: string) =>
  ["gdtSavedPassword", mst] as const;

/** Query mật khẩu đã lưu — chỉ chạy khi dialog mở và đã biết MST. */
export function useGdtSavedPasswordQuery(mst: string, enabled: boolean) {
  return useQuery({
    queryKey: gdtSavedPasswordKey(mst),
    queryFn: getGdtSavedPassword,
    enabled: enabled && !!mst,
    // Mật khẩu có thể vừa được cập nhật sau lần đăng nhập trước; luôn coi là cũ để nạp lại mỗi lần
    // mở dialog.
    staleTime: 0,
  });
}

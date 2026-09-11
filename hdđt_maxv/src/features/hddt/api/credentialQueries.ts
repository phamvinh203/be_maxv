import { useQuery } from "@tanstack/react-query";
import { getGdtSavedPassword } from "./gdt";

/**
 * Công ty đang chọn đã lưu mật khẩu cổng thuế chưa (server không trả mật khẩu). Server suy theo MST
 * công ty đang chọn (JWT), nên key gắn `mst` để đổi công ty là tự nạp lại.
 * Dùng: `DialogLoginHddt` (cho phép để trống ô mật khẩu khi đã lưu).
 */
export const gdtSavedPasswordKey = (mst: string) =>
  ["gdtSavedPassword", mst] as const;

/** Query cờ "đã lưu mật khẩu" — chỉ chạy khi dialog mở và đã biết MST. */
export function useGdtSavedPasswordQuery(mst: string, enabled: boolean) {
  return useQuery({
    queryKey: gdtSavedPasswordKey(mst),
    queryFn: getGdtSavedPassword,
    enabled: enabled && !!mst,
    // Mật khẩu có thể vừa được lưu sau lần đăng nhập trước; luôn coi là cũ để nạp lại mỗi lần mở
    // dialog.
    staleTime: 0,
  });
}

import { useQuery } from "@tanstack/react-query";
import { getTaxPayer, LOOKUP_MST_REGEX } from "./taxPayerApi";

/**
 * Tra thông tin công ty theo MST để điền sẵn form thêm công ty.
 *
 * - `retry: false`: 404 (MST không tồn tại) và 429 (quá nhanh) đều retry vô nghĩa,
 *   mà còn đốt thêm hạn mức 10 lần/30s của API.
 * - `staleTime: Infinity`: thông tin đăng ký thuế gần như không đổi trong một phiên,
 *   nên gõ lại MST đã tra thì lấy luôn từ cache, không bắn request mới.
 *
 * Dùng: `CompanyFormDialog` — `mst` là giá trị ô MST đã debounce.
 */
export function useTaxPayerQuery(mst: string, enabled: boolean) {
  return useQuery({
    queryKey: ["tax-payer", mst],
    queryFn: () => getTaxPayer(mst),
    enabled: enabled && LOOKUP_MST_REGEX.test(mst),
    retry: false,
    staleTime: Infinity,
  });
}

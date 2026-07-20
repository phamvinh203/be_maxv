import { useMemo } from "react";
import { useAuth } from "./useAuth";

/**
 * MST của công ty đang chọn (đã trim) — nguồn chuẩn DUY NHẤT để chọn token GDT khi fetch/đồng bộ.
 *
 * QUAN TRỌNG: KHÔNG dùng `currentGdtMst` (MST đăng nhập GDT gần nhất) để quyết định fetch — nó
 * tách rời khỏi công ty app đang chọn. Nếu lệch, hóa đơn của MST khác sẽ bị ghi vào DB tenant hiện
 * tại (bug rò rỉ dữ liệu giữa các MST). Luôn lấy token theo MST công ty đang chọn: `getGdtToken(mst)`.
 *
 * `undefined` nếu chưa chọn công ty hoặc công ty chưa có MST.
 */
export function useActiveCompanyMst(): string | undefined {
  const { companies, currentCompanyId } = useAuth();
  return useMemo(
    () =>
      companies.find((c) => c.id === currentCompanyId)?.maSoThue?.trim() || undefined,
    [companies, currentCompanyId],
  );
}

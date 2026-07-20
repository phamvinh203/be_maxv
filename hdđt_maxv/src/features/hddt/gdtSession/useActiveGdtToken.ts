import { useMemo } from "react";
import { useActiveCompanyMst } from "../../auth/useActiveCompanyMst";
import { useGdtSession } from "./useGdtSession";

/**
 * Token GDT của ĐÚNG công ty đang chọn (theo MST) — ĐIỂM CHỌN TOKEN DUY NHẤT.
 *
 * Gom `getGdtToken(activeMst)` về một chỗ để không nơi nào tự ghép rồi lỡ dùng nhầm MST khác
 * (bug rò rỉ dữ liệu giữa tenant: fetch data MST này nhưng ghi vào DB tenant kia). Mọi luồng
 * fetch/đồng bộ phải lấy token qua hook này, KHÔNG dùng `currentGdtMst`.
 *
 * `token` undefined nếu công ty đang chọn chưa đăng nhập GDT (hoặc chưa chọn công ty có MST).
 */
export function useActiveGdtToken(): { activeMst?: string; token?: string } {
  const activeMst = useActiveCompanyMst();
  const { getGdtToken } = useGdtSession();
  return useMemo(
    () => ({ activeMst, token: activeMst ? getGdtToken(activeMst) : undefined }),
    [activeMst, getGdtToken],
  );
}

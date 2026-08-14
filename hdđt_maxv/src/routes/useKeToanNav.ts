import { useNavigate } from "react-router-dom";

/**
 * Điều hướng trong module Kế toán (`/accounting/...`). Khác `hrm`/fe_maxv: không có
 * :slug công ty trên URL — dùng chung công ty đang chọn của cả app (useActiveCompanyMst).
 */
export function useKeToanNav() {
  const navigate = useNavigate();
  const goTo = (path: string) => navigate(`/accounting/${path}`);
  return { goTo };
}

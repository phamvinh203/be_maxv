import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../lib/http";
import { useAuth } from "../../auth/useAuth";

export interface SystemStats {
  /** Số hóa đơn mua vào đã lưu (vct60view). */
  purchase: number;
  /** Số hóa đơn bán ra đã lưu (vct50view). */
  sold: number;
  /** Thời điểm đồng bộ gần nhất (ISO) hoặc null nếu chưa đồng bộ. */
  lastSyncAt: string | null;
}

/** GET /gdt/stats — thống kê dữ liệu đã lưu của công ty (không cần token GDT). */
export async function getSystemStats(appToken: string): Promise<SystemStats> {
  return apiFetch<SystemStats>("/gdt/stats", { token: appToken });
}

export const statsKeys = {
  system: (companyId: string | null) => ["systemStats", companyId] as const,
};

/** Thống kê dữ liệu hệ thống — gắn companyId để đúng theo công ty đang chọn. */
export function useSystemStatsQuery() {
  const { accessToken, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: statsKeys.system(currentCompanyId),
    queryFn: () => getSystemStats(accessToken as string),
    enabled: !!accessToken && !!currentCompanyId,
  });
}

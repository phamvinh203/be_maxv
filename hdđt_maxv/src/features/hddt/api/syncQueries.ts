import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import { clearSyncData, getSyncHistory, startSync } from "./sync";
import { invoiceKeys } from "./invoiceQueries";
import { statsKeys } from "./statsQueries";
import type { SyncRequest } from "../types";

// Gắn `companyId` vì lịch sử/hóa đơn nằm ở DB riêng từng tenant.
export const syncKeys = {
  history: (companyId: string | null) => ["syncHistory", companyId] as const,
};

/**
 * Invalidate mọi query phụ thuộc dữ liệu hóa đơn của 1 tenant (lịch sử + bảng hóa đơn + thống kê).
 * Gọi sau khi đồng bộ/xóa để các nơi đang xem tự cập nhật. Gom 1 chỗ để 2 mutation không lệch nhau.
 */
function invalidateTenantInvoiceData(qc: QueryClient, companyId: string | null): void {
  qc.invalidateQueries({ queryKey: syncKeys.history(companyId) });
  qc.invalidateQueries({ queryKey: invoiceKeys.byCompany(companyId) });
  qc.invalidateQueries({ queryKey: statsKeys.system(companyId) });
}

/**
 * Lịch sử đồng bộ (không cần token GDT). Chỉ fetch khi dialog mở + có accessToken/công ty.
 * Dùng: `SyncInvoiceDialog` — bảng "Lịch sử đồng bộ hóa đơn" (enabled = open).
 */
export function useSyncHistoryQuery(enabled: boolean) {
  const { accessToken, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: syncKeys.history(currentCompanyId),
    queryFn: () => getSyncHistory(accessToken as string),
    enabled: enabled && !!accessToken && !!currentCompanyId,
  });
}

/**
 * Chạy đồng bộ; onSuccess invalidate lịch sử để bảng tự cập nhật.
 * Dùng: `SyncInvoiceDialog.handleSync` — nút "Đồng bộ".
 */
export function useStartSyncMutation() {
  const { accessToken, currentCompanyId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { gdtToken: string; body: SyncRequest }) =>
      startSync(accessToken as string, vars.gdtToken, vars.body),
    onSuccess: () => invalidateTenantInvoiceData(qc, currentCompanyId),
  });
}

/**
 * Xóa hóa đơn đã lưu + lịch sử; invalidate cả lịch sử lẫn danh sách hóa đơn đã lưu của công ty.
 * Dùng: `SyncInvoiceDialog.handleClear` — nút "Xóa dữ liệu đã đồng bộ".
 */
export function useClearSyncMutation() {
  const { accessToken, currentCompanyId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clearSyncData(accessToken as string),
    onSuccess: () => invalidateTenantInvoiceData(qc, currentCompanyId),
  });
}

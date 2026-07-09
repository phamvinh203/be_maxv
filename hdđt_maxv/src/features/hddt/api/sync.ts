import { apiFetch } from "../../../lib/http";
import type { ClearSyncResult, SyncLog, SyncRequest } from "../types";

/**
 * POST /gdt/sync — chạy đồng bộ 1 khoảng ngày (BE lặp hết trang GDT + lưu DB + ghi lịch sử).
 * Cần `appToken` (JWT app, để BE biết DB công ty nào) và `gdtToken` (token Thuế điện tử).
 * Dùng: `useStartSyncMutation` (syncQueries) — nút "Đồng bộ" trong SyncInvoiceDialog.
 */
export async function startSync(
  appToken: string,
  gdtToken: string,
  body: SyncRequest,
): Promise<SyncLog> {
  return apiFetch<SyncLog>("/gdt/sync", {
    method: "POST",
    token: appToken,
    headers: { "X-Gdt-Token": gdtToken },
    body: JSON.stringify(body),
  });
}

/**
 * GET /gdt/sync/history — danh sách lịch sử đồng bộ (không cần token GDT).
 * Dùng: `useSyncHistoryQuery` (syncQueries) — bảng "Lịch sử đồng bộ" trong SyncInvoiceDialog.
 */
export async function getSyncHistory(appToken: string): Promise<SyncLog[]> {
  return apiFetch<SyncLog[]>("/gdt/sync/history", { token: appToken });
}

/**
 * DELETE /gdt/sync/data — xóa hóa đơn đã lưu + lịch sử đồng bộ (không đụng dữ liệu GDT gốc).
 * Dùng: `useClearSyncMutation` (syncQueries) — nút "Xóa dữ liệu đã đồng bộ".
 */
export async function clearSyncData(appToken: string): Promise<ClearSyncResult> {
  return apiFetch<ClearSyncResult>("/gdt/sync/data", {
    method: "DELETE",
    token: appToken,
  });
}

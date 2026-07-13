import { apiFetch } from "../../../lib/http";
import type { ClearSyncResult, SyncLog, SyncRequest } from "../types";

/**
 * POST /gdt/sync — chạy đồng bộ 1 khoảng ngày (BE lặp hết trang GDT + lưu DB + ghi lịch sử).
 * Auth app qua cookie httpOnly (BE biết DB công ty nào); chỉ truyền `gdtToken` (token Thuế điện tử).
 * Dùng: `useStartSyncMutation` (syncQueries) — nút "Đồng bộ" trong SyncInvoiceDialog.
 */
export async function startSync(
  gdtToken: string,
  body: SyncRequest,
): Promise<SyncLog> {
  return apiFetch<SyncLog>("/gdt/sync", {
    method: "POST",
    headers: { "X-Gdt-Token": gdtToken },
    body: JSON.stringify(body),
  });
}

/**
 * GET /gdt/sync/history — danh sách lịch sử đồng bộ (không cần token GDT).
 * Dùng: `useSyncHistoryQuery` (syncQueries) — bảng "Lịch sử đồng bộ" trong SyncInvoiceDialog.
 */
export async function getSyncHistory(): Promise<SyncLog[]> {
  return apiFetch<SyncLog[]>("/gdt/sync/history");
}

/**
 * DELETE /gdt/sync/data — xóa hóa đơn đã lưu + lịch sử đồng bộ (không đụng dữ liệu GDT gốc).
 * Dùng: `useClearSyncMutation` (syncQueries) — nút "Xóa dữ liệu đã đồng bộ".
 */
export async function clearSyncData(): Promise<ClearSyncResult> {
  return apiFetch<ClearSyncResult>("/gdt/sync/data", { method: "DELETE" });
}

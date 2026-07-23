import { apiFetch } from "../../../lib/http";
import type { ClearSyncResult, SyncLog, SyncRequest, SyncRunStatus } from "../types";

/**
 * POST /gdt/sync/run — bắt đầu lượt đồng bộ CHẠY NỀN ở BE, trả tiến độ NGAY (~50ms) thay vì chờ
 * hết lượt. FE poll `getSyncRunStatus` tới khi `active=false`: lượt đồng bộ dài hàng chục phút,
 * giữ một request mở lâu như vậy sẽ bị proxy cắt thành 502.
 * BE từ chối chạy chồng: đang có lượt thì trả lại chính lượt đó. Dùng: `useStartSyncRunMutation`.
 */
export async function startSyncRun(
  gdtToken: string,
  body: SyncRequest,
): Promise<SyncRunStatus> {
  return apiFetch<SyncRunStatus>("/gdt/sync/run", {
    method: "POST",
    headers: { "X-Gdt-Token": gdtToken },
    body: JSON.stringify(body),
  });
}

/** GET /gdt/sync/run/status — tiến độ lượt đồng bộ nền (KHÔNG cần token GDT). Dùng: vòng poll. */
export async function getSyncRunStatus(): Promise<SyncRunStatus> {
  return apiFetch<SyncRunStatus>("/gdt/sync/run/status");
}

/**
 * POST /gdt/sync/run/cancel — bấm Dừng. BE thoát ở ranh giới trang gần nhất (không cắt ngang call
 * GDT đang bay), phần đã lấy vẫn được giữ + ghi vào lịch sử với trạng thái "partial".
 */
export async function cancelSyncRun(): Promise<SyncRunStatus> {
  return apiFetch<SyncRunStatus>("/gdt/sync/run/cancel", { method: "POST" });
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

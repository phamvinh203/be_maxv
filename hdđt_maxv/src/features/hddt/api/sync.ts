import { apiFetch } from "../../../lib/http";
import type { ClearSyncResult, SyncLog, SyncRequest, SyncResult } from "../types";

/**
 * POST /gdt/sync — chạy đồng bộ DANH SÁCH 1 khoảng ngày (BE lặp hết trang GDT + soát/bổ sung DB +
 * ghi lịch sử). KHÔNG tự tải chi tiết: FE tự lái sau khi có kết quả (startDetailRun + poll) theo từng
 * chiều, giống nút "Cập nhật từ Thuế điện tử". Auth app qua cookie httpOnly; chỉ truyền `gdtToken`.
 * Trả MẢNG kết quả — 1 phần tử/chiều (direction="all" -> 2: mua vào + bán ra), kèm số liệu đối chiếu
 * (`daCo`/`boSung`) để hiện toast. Dùng: `useStartSyncMutation`.
 */
export async function startSync(
  gdtToken: string,
  body: SyncRequest,
): Promise<SyncResult[]> {
  return apiFetch<SyncResult[]>("/gdt/sync", {
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

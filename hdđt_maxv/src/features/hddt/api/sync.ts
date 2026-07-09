import { apiFetch } from "../../../lib/http";

/** Chiều đồng bộ hóa đơn (khớp BE). */
export type SyncDirection = "all" | "purchase" | "sold";
/** Loại hóa đơn theo cách xử lý máy tính tiền (ctt = hóa đơn máy tính tiền). */
export type SyncKind = "all" | "except_ctt" | "only_ctt";

export interface SyncRequest {
  /** yyyy-MM-dd */
  tuNgay: string;
  /** yyyy-MM-dd */
  denNgay: string;
  direction: SyncDirection;
  loai: SyncKind;
}

/** 1 dòng lịch sử đồng bộ (bảng sync_log bên BE) — ngày ở dạng chuỗi ISO. */
export interface SyncLog {
  id: string;
  tu_ngay: string;
  den_ngay: string;
  direction: SyncDirection;
  loai: SyncKind;
  /** Tổng hóa đơn GDT báo có trong khoảng. */
  tong: number;
  /** Số hóa đơn thực sự đã lưu vào DB. */
  da_luu: number;
  trang_thai: "done" | "partial";
  dien_giai: string | null;
  created_at: string;
}

export interface ClearSyncResult {
  purchase: number;
  sold: number;
  logs: number;
}

/**
 * POST /gdt/sync — chạy đồng bộ 1 khoảng ngày (BE lặp hết trang GDT + lưu DB + ghi lịch sử).
 * Cần `appToken` (JWT app, để BE biết DB công ty nào) và `gdtToken` (token Thuế điện tử).
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

/** GET /gdt/sync/history — danh sách lịch sử đồng bộ (không cần token GDT). */
export async function getSyncHistory(appToken: string): Promise<SyncLog[]> {
  return apiFetch<SyncLog[]>("/gdt/sync/history", { token: appToken });
}

/** DELETE /gdt/sync/data — xóa hóa đơn đã lưu + lịch sử đồng bộ (không đụng dữ liệu GDT gốc). */
export async function clearSyncData(appToken: string): Promise<ClearSyncResult> {
  return apiFetch<ClearSyncResult>("/gdt/sync/data", {
    method: "DELETE",
    token: appToken,
  });
}

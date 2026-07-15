import { apiFetch } from "../../../lib/http";
import { buildInvoiceParams } from "./gdt";
import type {
  InvoiceDetailResult,
  InvoiceDirection,
  InvoiceQuery,
} from "../types";

/**
 * POST /gdt/invoices/detail/:id → tải chi tiết 1 hóa đơn đã lưu từ GDT (lưu detail + tt_tai).
 * Dùng cho luồng chạy tiến trình từng hóa đơn (progressive) trong `InvoiceTablePanel`.
 */
export function fetchOneInvoiceDetail(
  direction: InvoiceDirection,
  id: string,
  gdtToken: string,
): Promise<InvoiceDetailResult> {
  return apiFetch<InvoiceDetailResult>(`/gdt/invoices/detail/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "X-Gdt-Token": gdtToken },
    body: JSON.stringify({ direction }),
  });
}

/**
 * GET /gdt/invoices/:direction/saved-details → đọc payload chi tiết ĐÃ LƯU (không gọi GDT),
 * cho tab "Chi tiết hóa đơn" hiển thị tất cả. Trả mảng payload GDT gốc (có mảng hàng `hdhhdvu`).
 * Dùng chung `buildInvoiceParams` với luồng danh sách để map đúng MST đối tác theo chiều.
 * Dùng: `useSavedDetailsQuery`.
 */
export async function getSavedDetails(
  direction: InvoiceDirection,
  query: InvoiceQuery,
): Promise<Record<string, unknown>[]> {
  const params = buildInvoiceParams(direction, query);
  const raw = await apiFetch<{ datas?: Record<string, unknown>[] }>(
    `/gdt/invoices/${direction}/saved-details?${params.toString()}`,
  );
  return raw.datas ?? [];
}

/** Tiến độ lượt tải chi tiết chạy nền ở BE (FE poll qua `getDetailRunStatus`). */
export interface DetailRunStatus {
  active: boolean;
  total: number;
  done: number;
  ok: number;
  err: number;
  /** true nếu lượt dừng sớm vì token GDT hết hạn — FE nhắc đăng nhập lại. */
  authExpired?: boolean;
}

/**
 * POST /gdt/invoices/:direction/detail-run → BE bắt đầu lượt tải chi tiết CHẠY NỀN (thay thế lượt cũ
 * nếu đang chạy) qua pacer dùng chung (429-retry). Trả tiến độ ngay; FE poll `getDetailRunStatus`
 * tới khi xong. Cần token GDT (BE gọi GDT). Dùng: nút "Cập nhật từ Thuế điện tử" / "Tải chi tiết".
 */
export function startDetailRun(
  direction: InvoiceDirection,
  gdtToken: string,
  query: InvoiceQuery,
): Promise<DetailRunStatus> {
  const params = buildInvoiceParams(direction, query);
  return apiFetch<DetailRunStatus>(`/gdt/invoices/${direction}/detail-run?${params.toString()}`, {
    method: "POST",
    headers: { "X-Gdt-Token": gdtToken },
  });
}

/**
 * GET /gdt/invoices/:direction/detail-run/status → tiến độ lượt tải chi tiết hiện tại (KHÔNG cần
 * token GDT). Dùng: FE poll trong lúc BE tải chi tiết ngầm.
 */
export function getDetailRunStatus(direction: InvoiceDirection): Promise<DetailRunStatus> {
  return apiFetch<DetailRunStatus>(`/gdt/invoices/${direction}/detail-run/status`);
}

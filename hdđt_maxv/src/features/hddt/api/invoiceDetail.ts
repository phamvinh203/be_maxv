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

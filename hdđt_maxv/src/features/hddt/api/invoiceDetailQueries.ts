import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import { getDetailComplete, getSavedDetails, getSavedInvoiceDetailById } from "./invoiceDetail";
import type { InvoiceDirection, InvoiceQuery } from "../types";

// Gắn `companyId` vì chi tiết nằm ở DB riêng từng tenant (đổi công ty đổi key -> fetch đúng).
export const detailKeys = {
  /** Prefix để invalidate mọi chi tiết đã lưu của 1 chiều (bất kể bộ lọc). */
  byDirection: (companyId: string | null, direction: InvoiceDirection) =>
    ["savedDetails", companyId, direction] as const,
  /** Key đầy đủ 1 lần đọc chi tiết (công ty + chiều + bộ lọc đã áp dụng). */
  saved: (companyId: string | null, direction: InvoiceDirection, query: InvoiceQuery) =>
    ["savedDetails", companyId, direction, query] as const,
  /** Key chi tiết ĐÃ LƯU của 1 hóa đơn theo id (nút "Xem hóa đơn"). */
  byId: (companyId: string | null, direction: InvoiceDirection, id: string) =>
    ["savedDetail", companyId, direction, id] as const,
  /** Key đếm HĐ hoàn thành chi tiết trong khoảng (gate nút Xuất tổng hợp). */
  complete: (companyId: string | null, direction: InvoiceDirection, query: InvoiceQuery) =>
    ["detailComplete", companyId, direction, query] as const,
};

/**
 * Đọc chi tiết ĐÃ LƯU của tất cả hóa đơn trong khoảng (không gọi GDT) — nguồn cho tab "Chi tiết".
 * `enabled` cho phép chỉ fetch khi tab "Chi tiết" đang mở (chi tiết nặng, đừng nạp khi chưa xem).
 */
export function useSavedDetailsQuery(
  direction: InvoiceDirection,
  query: InvoiceQuery,
  enabled: boolean,
) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: detailKeys.saved(currentCompanyId, direction, query),
    queryFn: () => getSavedDetails(direction, query),
    enabled:
      enabled && isAuthenticated && !!currentCompanyId && !!query.tuNgay && !!query.denNgay,
    // Payload chi tiết nặng (tối đa 1000 blob) — giữ cache 5 phút để đổi qua lại tab không refetch.
    // Sau khi tải chi tiết xong đã invalidate detailKeys.byDirection nên vẫn luôn mới khi cần.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Đếm HĐ + số HĐ chưa có chi tiết trong khoảng (gate nút "Xuất file tổng hợp + hóa đơn"). `enabled`
 * chỉ bật khi dialog xuất mở + có đủ khoảng ngày. Không gọi GDT — đọc DB.
 */
export function useDetailCompleteQuery(
  direction: InvoiceDirection,
  query: InvoiceQuery,
  enabled: boolean,
) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: detailKeys.complete(currentCompanyId, direction, query),
    queryFn: () => getDetailComplete(direction, query),
    enabled:
      enabled && isAuthenticated && !!currentCompanyId && !!query.tuNgay && !!query.denNgay,
  });
}

/**
 * Đọc chi tiết ĐÃ LƯU của 1 hóa đơn theo `id` — nguồn cho `InvoiceViewDialog` (nút "Xem hóa đơn").
 * `enabled` chỉ bật khi dialog mở & có id (đừng fetch khi chưa mở). Không gọi GDT — đọc DB.
 */
export function useSavedInvoiceDetailByIdQuery(
  direction: InvoiceDirection,
  id: string | null,
  enabled: boolean,
) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: detailKeys.byId(currentCompanyId, direction, id ?? ""),
    queryFn: () => getSavedInvoiceDetailById(direction, id as string),
    enabled: enabled && isAuthenticated && !!currentCompanyId && !!id,
    staleTime: 5 * 60 * 1000,
  });
}

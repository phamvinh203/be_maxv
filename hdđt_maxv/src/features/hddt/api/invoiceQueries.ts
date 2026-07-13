import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import { getInvoices, getSavedInvoices } from "./gdt";
import type { InvoiceDirection, InvoiceQuery } from "../types";

// Khóa gắn `companyId` (công ty đang chọn) vì hóa đơn nằm ở DB riêng của từng tenant —
// đổi công ty đổi key -> tự fetch đúng dữ liệu, không rò dữ liệu công ty cũ.
export const invoiceKeys = {
  /** Prefix mọi query hóa đơn đã lưu của 1 công ty. */
  byCompany: (companyId: string | null) => ["savedInvoices", companyId] as const,
  /** Prefix để invalidate mọi query đã lưu của 1 chiều (bất kể bộ lọc). */
  savedByDirection: (companyId: string | null, direction: InvoiceDirection) =>
    ["savedInvoices", companyId, direction] as const,
  /** Key đầy đủ cho 1 lần đọc DB (công ty + chiều + bộ lọc đã áp dụng). */
  saved: (companyId: string | null, direction: InvoiceDirection, query: InvoiceQuery) =>
    ["savedInvoices", companyId, direction, query] as const,
};

/**
 * Đọc hóa đơn đã lưu trong DB (không gọi GDT). Tự fetch lại khi `query` (bộ lọc đã áp
 * dụng) hoặc công ty đang chọn đổi. `enabled` cho phép hoãn fetch khi tab đang ẩn.
 * Dùng: `InvoiceTablePanel` (InvoiceListTabs) — nguồn dữ liệu bảng "Tổng quát".
 */
export function useSavedInvoicesQuery(
  direction: InvoiceDirection,
  query: InvoiceQuery,
  enabled: boolean,
) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: invoiceKeys.saved(currentCompanyId, direction, query),
    queryFn: () => getSavedInvoices(direction, query),
    enabled:
      enabled && isAuthenticated && !!currentCompanyId && !!query.tuNgay && !!query.denNgay,
  });
}

/**
 * Tra cứu GDT (BE luôn lưu vào DB) rồi invalidate query "đã lưu" của cùng chiều để
 * bảng tự nạp lại từ DB. Trả về kết quả GDT (có `saved`) cho nơi gọi hiển thị.
 * Dùng: `InvoiceTablePanel.handleFetchGdt` — nút "Cập nhật từ Thuế điện tử".
 */
export function useFetchGdtInvoicesMutation(direction: InvoiceDirection) {
  const { currentCompanyId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { gdtToken: string; query: InvoiceQuery }) =>
      getInvoices(direction, vars.gdtToken, vars.query),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: invoiceKeys.savedByDirection(currentCompanyId, direction),
      }),
  });
}

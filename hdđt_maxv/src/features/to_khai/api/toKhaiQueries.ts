import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth";
import { getBangKe, postKeKhai } from "./toKhai";
import type { Ky } from "../ky";
import type { InvoiceDirection } from "../../hddt/types";

// Khóa gắn `companyId` vì tờ khai nằm ở DB riêng từng tenant — đổi công ty là đổi key, không rò
// dữ liệu công ty cũ (cùng quy ước `invoiceKeys` bên mô-đun hóa đơn).
export const toKhaiKeys = {
  byCompany: (companyId: string | null) => ["toKhai", companyId] as const,
  bangKe: (companyId: string | null, ky: Ky, chieu: InvoiceDirection) =>
    ["toKhai", companyId, "bangKe", ky, chieu] as const,
};

/** Bảng kê một kỳ/một chiều. `enabled=false` cho tab đang ẩn để khỏi gọi API thừa. */
export function useBangKeQuery(ky: Ky, chieu: InvoiceDirection, enabled = true) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: toKhaiKeys.bangKe(currentCompanyId, ky, chieu),
    queryFn: () => getBangKe(ky, chieu),
    enabled: enabled && isAuthenticated && !!currentCompanyId,
  });
}

/**
 * Lượt "Kê khai" — gán hóa đơn vào kỳ. Xong thì bỏ toàn bộ cache của mô-đun tờ khai: kỳ vừa gán
 * (và cả kỳ CŨ mà hóa đơn vừa bị chuyển đi) đều đổi nội dung, mà cache theo từng kỳ nên không
 * biết trước kỳ nào bị ảnh hưởng.
 */
export function useKeKhaiMutation() {
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();
  return useMutation({
    mutationFn: (ky: Ky) => postKeKhai(ky),
    onSuccess: () => qc.invalidateQueries({ queryKey: toKhaiKeys.byCompany(currentCompanyId) }),
  });
}

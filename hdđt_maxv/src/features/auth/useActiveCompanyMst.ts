import { useMemo } from "react";
import { useAuth } from "./useAuth";
import type { AuthCompany } from "./types";

/**
 * Công ty đang chọn (bản ghi đầy đủ) — dùng khi cần cả tên đơn vị chứ không riêng MST, vd dòng
 * "Đơn vị:" đầu file Excel tổng hợp. `undefined` nếu chưa chọn công ty.
 *
 * Tra cứu để ĐÚNG MỘT CHỖ (hook này): MST và tên đơn vị phải luôn của cùng một công ty — hai chỗ tra
 * riêng là có ngày file ghi MST công ty này kèm tên công ty kia.
 */
export function useActiveCompany(): AuthCompany | undefined {
  const { companies, currentCompanyId } = useAuth();
  return useMemo(
    () => companies.find((c) => c.id === currentCompanyId),
    [companies, currentCompanyId],
  );
}

/**
 * MST của công ty đang chọn (đã trim) — nguồn chuẩn DUY NHẤT để chọn token GDT khi fetch/đồng bộ.
 *
 * QUAN TRỌNG: KHÔNG dùng `currentGdtMst` (MST đăng nhập GDT gần nhất) để quyết định fetch — nó
 * tách rời khỏi công ty app đang chọn. Nếu lệch, hóa đơn của MST khác sẽ bị ghi vào DB tenant hiện
 * tại (bug rò rỉ dữ liệu giữa các MST). Luôn lấy token theo MST công ty đang chọn: `getGdtToken(mst)`.
 *
 * `undefined` nếu chưa chọn công ty hoặc công ty chưa có MST.
 */
export function useActiveCompanyMst(): string | undefined {
  return useActiveCompany()?.maSoThue?.trim() || undefined;
}

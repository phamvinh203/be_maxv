import { TAX_PAYER_API_BASE } from "../../../config/api";
import { ApiError } from "../../../lib/http";
import type { TaxPayerInfo } from "../types";

/**
 * GET {TAX_PAYER_API_BASE}/tax-payer/{mst} → thông tin đăng ký thuế của MST.
 * Gọi bằng fetch trần (không qua `apiFetch`): đây là dịch vụ ngoài, không được
 * gắn API_BASE của be_maxv và không được gửi cookie phiên sang bên thứ 3 —
 * fetch mặc định `credentials: "same-origin"` nên cross-origin sẽ không kèm cookie.
 * Dùng: `useTaxPayerQuery` (queryFn).
 */
export async function getTaxPayer(mst: string): Promise<TaxPayerInfo> {
  const res = await fetch(`${TAX_PAYER_API_BASE}/tax-payer/${encodeURIComponent(mst)}`);

  // Ném `ApiError` (không phải Error trần) để nơi gọi rẽ nhánh được theo `.status` — vd sau này
  // muốn retry riêng 429 mà không retry 404 thì khỏi phải so sánh chuỗi tiếng Việt.
  if (!res.ok) {
    const message =
      res.status === 404
        ? "Không tìm thấy mã số thuế này."
        : res.status === 429
          ? "Tra cứu quá nhanh, thử lại sau ít giây."
          : `Không tra cứu được mã số thuế (${res.status}).`;
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as TaxPayerInfo;
}

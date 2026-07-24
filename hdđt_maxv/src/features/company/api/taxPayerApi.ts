import { TAX_PAYER_API_BASE } from "../../../config/api";
import type { TaxPayerInfo } from "../types";

/**
 * Chỉ MST 10 số mới tra được — MST chi nhánh dạng `0201964163-001` API trả 404,
 * nên chặn từ đầu cho khỏi phí một lượt rate limit (10 lần/30s theo IP).
 * Dùng: `useTaxPayerQuery` để bật/tắt query.
 */
export const LOOKUP_MST_REGEX = /^[0-9]{10}$/;

/**
 * GET {TAX_PAYER_API_BASE}/tax-payer/{mst} → thông tin đăng ký thuế của MST.
 * Gọi bằng fetch trần (không qua `apiFetch`): đây là dịch vụ ngoài, không được
 * gắn API_BASE của be_maxv và không được gửi cookie phiên sang bên thứ 3 —
 * fetch mặc định `credentials: "same-origin"` nên cross-origin sẽ không kèm cookie.
 * Dùng: `useTaxPayerQuery` (queryFn).
 */
export async function getTaxPayer(mst: string): Promise<TaxPayerInfo> {
  const res = await fetch(`${TAX_PAYER_API_BASE}/tax-payer/${encodeURIComponent(mst)}`);

  if (!res.ok) {
    if (res.status === 404) throw new Error("Không tìm thấy mã số thuế này.");
    if (res.status === 429) throw new Error("Tra cứu quá nhanh, thử lại sau ít giây.");
    throw new Error(`Không tra cứu được mã số thuế (${res.status}).`);
  }

  return (await res.json()) as TaxPayerInfo;
}

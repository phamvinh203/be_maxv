/** Chiều của hóa đơn trong bảng kê tờ khai. */
export type Chieu = "purchase" | "sold";

/** Hai chiều luôn được xử lý cùng nhau khi gán hóa đơn cho kỳ. */
export const CA_HAI_CHIEU: readonly Chieu[] = ["purchase", "sold"];

/** View tenant tương ứng với chiều hóa đơn. */
export function tenViewHoaDon(chieu: Chieu): "vct50view" | "vct60view" {
  return chieu === "purchase" ? "vct60view" : "vct50view";
}

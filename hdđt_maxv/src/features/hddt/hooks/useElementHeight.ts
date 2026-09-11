/**
 * Re-export tạm — implementation THẬT đã chuyển sang `src/hooks/useKichThuocPhanTu.ts` (RVW-A13,
 * `docs/hrm/review-findings.md`: nội dung hoàn toàn generic, không riêng gì hóa đơn điện tử, và
 * đang được `to_khai` lẫn `hrm` dùng chung — nên phải ở hạ tầng dùng chung của `src/`, không nằm
 * trong `features/hddt/`).
 *
 * File này CHỈ còn vì các consumer khác trong `features/hddt/**` (`InvoiceDetailPanel.tsx`,
 * `InvoiceListTabs.tsx`, `templates/cells.tsx`) và `features/to_khai/**` còn trỏ vào đây, đang
 * nằm ngoài phạm vi sửa của đợt này (agent khác đang code song song trong `features/hddt/**`) —
 * xóa hẳn file này sẽ vỡ import của họ. Import mới (`hrm/components/dashboard/charts/BieuDoCot.tsx`)
 * đã trỏ thẳng `@/hooks/useKichThuocPhanTu`; khi các consumer còn lại đổi nốt import thì xóa file này.
 */
export { useElementHeight, useElementWidth } from "@/hooks/useKichThuocPhanTu";

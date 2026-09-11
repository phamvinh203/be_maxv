/**
 * Re-export tạm — implementation THẬT đã chuyển sang `components/SoField.tsx` (RVW-A12,
 * `docs/hrm/review-findings.md`: ≥2 module dùng nên phải ở hạ tầng dùng chung, không nằm
 * riêng trong `cau_hinh_mac_dinh/`).
 *
 * File này CHỈ còn vì `du_lieu_tinh_luong/tang_ca/QuanLyTangCaDialog.tsx` còn trỏ vào đây và
 * đang nằm ngoài phạm vi sửa của đợt này (agent khác đang code song song trong
 * `du_lieu_tinh_luong/**`) — xóa hẳn file này sẽ vỡ import của họ. Import mới ở mọi chỗ khác
 * đã trỏ thẳng `components/SoField.tsx`; khi `du_lieu_tinh_luong` rảnh tay đổi nốt import đó
 * thì xóa file này.
 */
export { default } from "../SoField";

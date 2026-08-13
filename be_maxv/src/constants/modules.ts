/**
 * Danh sách module bán kèm gói thuê bao.
 *
 * **Thêm module mới = thêm một khóa vào `MODULE_KEYS`.** Validator của gói,
 * kiểu dữ liệu và màn hình admin đều suy ra từ mảng này, không phải sửa chỗ
 * nào khác ở backend. Quyền lưu trong `SubscriptionPlan.features` (kiểu `Json`)
 * nên thêm module KHÔNG cần migration.
 */
export const MODULE_KEYS = ['hrm'] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Trạng thái bật/tắt của toàn bộ module. */
export type UserModules = Record<ModuleKey, boolean>;

/** Mọi module đều tắt — dùng cho user chưa đăng nhập hoặc không xác định được owner. */
export function khongCoModule(): UserModules {
  return Object.fromEntries(MODULE_KEYS.map((k) => [k, false])) as UserModules;
}

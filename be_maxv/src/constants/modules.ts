/**
 * Danh mục module bán kèm gói thuê bao — nguồn duy nhất của hệ thống (kèm nhãn
 * hiển thị cho màn hình admin).
 *
 * **Thêm module mới = thêm một phần tử vào `MODULES`.** Validator của gói,
 * kiểu dữ liệu và màn hình admin đều suy ra từ mảng này, không phải sửa chỗ
 * nào khác ở backend — maxv tự đọc qua `GET /api/v1/admin/modules`. Quyền lưu
 * trong `SubscriptionPlan.features` (kiểu `Json`) nên thêm module KHÔNG cần
 * migration.
 */
export const MODULES = [
  {
    key: 'hrm',
    nhanNgan: 'HRM',
    moTa: 'Quản lý nhân sự: phòng ban, hồ sơ nhân viên, chấm công, cấu hình lương.',
  },
  {
    key: 'accounting',
    nhanNgan: 'Kế toán',
    moTa: 'Quản lý kế toán: bán hàng, tổng hợp, tồn kho và các danh mục kế toán.',
  },
  {
    key: 'dvc',
    nhanNgan: 'Dịch vụ công',
    moTa: 'Tra cứu, đồng bộ và xem tờ khai/giấy nộp tiền qua cổng Dịch vụ công thuế điện tử.',
  },
  {
    key: 'tokhai',
    nhanNgan: 'Tờ khai',
    moTa: 'Lập tờ khai thuế GTGT mẫu 01/GTGT từ hóa đơn điện tử đã đồng bộ.',
  },
] as const;

export const MODULE_KEYS = MODULES.map((m) => m.key);

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Trạng thái bật/tắt của toàn bộ module. */
export type UserModules = Record<ModuleKey, boolean>;

/** Mọi module đều tắt — dùng cho user chưa đăng nhập hoặc không xác định được owner. */
export function khongCoModule(): UserModules {
  return Object.fromEntries(MODULE_KEYS.map((k) => [k, false])) as UserModules;
}

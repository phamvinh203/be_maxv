/**
 * Module bật/tắt được cho từng tài khoản.
 *
 * Phải khớp `MODULE_KEYS` bên `be_maxv/src/constants/modules.ts` — ba app không
 * dùng chung package nên đây là chỗ duy nhất phải nhớ đồng bộ. Thêm module mới:
 * thêm một dòng vào `MODULE_META`; bảng tài khoản và form gói tự hiện thêm.
 *
 * Quyền chỉ đến từ **gói thuê bao** — không có bật/tắt riêng theo tài khoản.
 */
export const MODULE_KEYS = ['hrm', 'accounting', 'dvc', 'tokhai'] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export type UserModules = Record<ModuleKey, boolean>;

interface ModuleMeta {
  /** Nhãn ngắn cho cột bảng và ô tick trong form gói. */
  nhanNgan: string;
  moTa: string;
}

export const MODULE_META: Record<ModuleKey, ModuleMeta> = {
  hrm: {
    nhanNgan: 'HRM',
    moTa: 'Quản lý nhân sự: phòng ban, hồ sơ nhân viên, chấm công, cấu hình lương.',
  },
  accounting: {
    nhanNgan: 'Kế toán',
    moTa: 'Quản lý kế toán: bán hàng, tổng hợp, tồn kho và các danh mục kế toán.',
  },
  dvc: {
    nhanNgan: 'Dịch vụ công',
    moTa: 'Tra cứu, đồng bộ và xem tờ khai/giấy nộp tiền qua cổng Dịch vụ công thuế điện tử.',
  },
  tokhai: {
    nhanNgan: 'Tờ khai',
    moTa: 'Lập tờ khai thuế GTGT mẫu 01/GTGT từ hóa đơn điện tử đã đồng bộ.',
  },
};

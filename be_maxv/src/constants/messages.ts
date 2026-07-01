/**
 * Toàn bộ chuỗi thông báo tiếng Việt gom một chỗ.
 * Dễ rà soát, sửa đổi, và sau này tách i18n.
 */
export const MESSAGES = {
  COMMON: {
    INTERNAL_ERROR: 'Lỗi máy chủ nội bộ',
    VALIDATION_FAILED: 'Dữ liệu không hợp lệ',
  },

  AUTH: {
    EMAIL_EXISTS: 'Email đã tồn tại',
    UNAUTHORIZED: 'Chưa đăng nhập hoặc token không hợp lệ',
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này',
    // Gộp 1 message cho cả email sai lẫn mật khẩu sai (chống dò tài khoản)
    INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng',
    ACCOUNT_INACTIVE: 'Tài khoản chưa được kích hoạt',
    REFRESH_INVALID: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại',
    LOGOUT_OK: 'Đã đăng xuất',
  },

  COMPANY: {
    USER_NOT_FOUND: 'Người dùng không tồn tại',
    USER_HAS_COMPANY: 'Người dùng này đã có công ty',
    MST_TAKEN: 'Mã số thuế đã được đăng ký',
    NOT_FOUND: 'Công ty không tồn tại',
    RETRY_NOT_FAILED: 'Chỉ cấp lại DB được cho công ty ở trạng thái FAILED',
    SUSPEND_NOT_READY: 'Chỉ tạm khóa được công ty đang hoạt động (READY)',
    RESUME_NOT_SUSPENDED: 'Chỉ mở lại được công ty đang bị khóa (SUSPENDED)',
    NO_TENANT_DB: 'Công ty chưa được cấp DB (provisioning chưa hoàn tất)',
    TENANT_DB_MISSING:
      'DB tenant không tồn tại (đã bị xóa hoặc cấp chưa xong). Đã đánh dấu FAILED — hãy cấp lại DB.',
    EMAIL_ALREADY_MEMBER: 'Email này đã thuộc một công ty khác',
    INVITE_ALREADY_PENDING: 'Email này đã có lời mời đang chờ duyệt',
    INVITE_NOTIFY_FAILED:
      'Không thể gửi email thông báo cho quản trị viên, vui lòng thử lại',
  },

  USER: {
    NOT_FOUND: 'Người dùng không tồn tại',
    CANNOT_DEACTIVATE_SELF: 'Không thể vô hiệu hóa chính tài khoản của bạn',
    CANNOT_CHANGE_OWN_ROLE: 'Không thể đổi vai trò của chính bạn',
    CANNOT_CHANGE_ADMIN:
      'Không thể đổi vai trò tài khoản quản trị hệ thống (thực hiện qua DB)',
  },

  SUBSCRIPTION: {
    PLAN_NOT_FOUND: 'Gói dịch vụ không tồn tại',
    PLAN_CODE_TAKEN: 'Mã gói đã tồn tại',
    SUB_NOT_FOUND: 'Thuê bao không tồn tại',
    SAME_PLAN: 'Thuê bao đang dùng đúng gói này',
    ALREADY_CANCELED: 'Thuê bao đã bị hủy',
  },

  VALIDATION: {
    INVALID_MST: 'Mã số thuế không hợp lệ',
    INVALID_PHONE: 'Số điện thoại không hợp lệ',
    PASSWORD_MIN: 'Mật khẩu tối thiểu 8 ký tự',
    PASSWORD_LETTER: 'Phải có chữ',
    PASSWORD_NUMBER: 'Phải có số',
  },
} as const;

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
    // Cố tình mơ hồ: KHÔNG tiết lộ email có tồn tại hay không (chống dò tài khoản).
    FORGOT_PASSWORD_SENT:
      'Nếu email tồn tại trong hệ thống, mã xác thực đã được gửi tới hộp thư của bạn',
    // Gộp 1 message cho cả "sai mã", "hết hạn", "đã dùng", "nhập sai quá số lần".
    OTP_INVALID: 'Mã xác thực không đúng hoặc đã hết hạn',
    RESET_PASSWORD_OK: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại',
  },

  COMPANY: {
    NO_COMPANY: 'Tài khoản chưa gắn với công ty nào',
    NO_ACCESS: 'Bạn không có quyền truy cập công ty này',
    USER_NOT_FOUND: 'Người dùng không tồn tại',
    USER_HAS_COMPANY: 'Người dùng này đã có công ty',
    MST_TAKEN: 'Mã số thuế đã được đăng ký',
    NOT_FOUND: 'Công ty không tồn tại',
    RETRY_NOT_FAILED: 'Chỉ cấp lại DB được cho công ty ở trạng thái FAILED',
    SUSPEND_NOT_READY: 'Chỉ tạm khóa được công ty đang hoạt động (READY)',
    RESUME_NOT_SUSPENDED: 'Chỉ mở lại được công ty đang bị khóa (SUSPENDED)',
    NO_TENANT_DB: 'Công ty chưa được cấp DB (provisioning chưa hoàn tất)',
    ALREADY_ARCHIVED: 'Công ty này đã được xóa trước đó',
    TENANT_DB_MISSING:
      'DB tenant không tồn tại (đã bị xóa hoặc cấp chưa xong). Đã đánh dấu FAILED — hãy cấp lại DB.',
    EMAIL_ALREADY_MEMBER: 'Email này đã thuộc một công ty khác',
    INVITE_ALREADY_PENDING: 'Email này đã có lời mời đang chờ duyệt',
    INVITE_NOTIFY_FAILED:
      'Không thể gửi email thông báo cho quản trị viên, vui lòng thử lại',
    INVITE_NOT_FOUND: 'Lời mời không tồn tại',
    INVITE_NOT_PENDING: 'Lời mời này đã được xử lý (không còn ở trạng thái chờ duyệt)',
    INVITE_WELCOME_MAIL_FAILED:
      'Không thể gửi email mật khẩu cho nhân viên, vui lòng thử lại',
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
    MST_LIMIT_REACHED: 'Gói hiện tại đã đạt giới hạn số công ty/MST được tạo',
    USER_LIMIT_REACHED: 'Gói hiện tại đã đạt giới hạn số nhân viên',
  },

  TON_KHO: {
    VT_NOT_FOUND: 'Không tìm thấy mặt hàng',
    DOI_MA_MISSING: 'Vui lòng nhập đầy đủ mã cũ và mã mới',
    DOI_MA_SAME: 'Mã mới phải khác mã cũ',
    DVT_NOT_FOUND: 'Không tìm thấy đơn vị tính',
    NHOM_NOT_FOUND: 'Không tìm thấy nhóm hàng hóa, vật tư',
    NHOM_LOAI_INVALID: 'Loại nhóm phải là 1, 2 hoặc 3',
    MAGD_NOT_FOUND: 'Không tìm thấy mã giao dịch',
    KHO_NOT_FOUND: 'Không tìm thấy kho hàng',
    NHOM_KHO_NOT_FOUND: 'Không tìm thấy nhóm kho',
    VI_TRI_NOT_FOUND: 'Không tìm thấy vị trí kho',
    LOAI_VT_NOT_FOUND: 'Không tìm thấy loại vật tư',
  },

  TONG_HOP: {
    TIEN_TE_NOT_FOUND: 'Không tìm thấy ngoại tệ',
    TAI_KHOAN_NOT_FOUND: 'Không tìm thấy tài khoản',
    PHONG_BAN_NOT_FOUND: 'Không tìm thấy phòng ban',
  },

  BAN_HANG: {
    KHACH_HANG_NOT_FOUND: 'Không tìm thấy khách hàng',
    HOA_DON_NOT_FOUND: 'Không tìm thấy hóa đơn bán hàng',
  },

  VALIDATION: {
    INVALID_MST: 'Mã số thuế không hợp lệ',
    INVALID_NAME: 'Họ tên không hợp lệ',
    INVALID_OTP: 'Mã xác thực phải gồm 6 chữ số',
    INVALID_PHONE: 'Số điện thoại không hợp lệ',
    PASSWORD_MIN: 'Mật khẩu tối thiểu 8 ký tự',
    PASSWORD_LETTER: 'Phải có chữ',
    PASSWORD_NUMBER: 'Phải có số',
  },
} as const;

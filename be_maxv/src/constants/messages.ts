/**
 * Toàn bộ chuỗi thông báo tiếng Việt gom một chỗ.
 * Dễ rà soát, sửa đổi, và sau này tách i18n.
 */
import { OTP_LENGTH } from './auth';

export const MESSAGES = {
  COMMON: {
    INTERNAL_ERROR: 'Lỗi máy chủ nội bộ',
    VALIDATION_FAILED: 'Dữ liệu không hợp lệ',
    // Ba thông điệp dưới dùng cho lỗi ràng buộc Postgres (xem errorHandler.plugin.ts).
    DUPLICATE_KEY: 'Dữ liệu bị trùng, vui lòng thử lại',
    RECORD_GONE: 'Bản ghi không còn tồn tại, vui lòng tải lại danh sách',
    STILL_REFERENCED:
      'Dữ liệu đang được sử dụng ở nơi khác, không thể thực hiện',
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
    FORGOT_PASSWORD_SENT: 'Mã xác thực đã được gửi tới hộp thư của bạn',
    EMAIL_NOT_REGISTERED: 'Email này chưa được đăng ký',
    OTP_TOO_MANY_REQUESTS:
      'Bạn đã yêu cầu mã xác thực quá nhiều lần. Vui lòng thử lại sau 1 giờ',
    // Gộp 1 message cho cả "sai mã", "hết hạn", "đã dùng", "nhập sai quá số lần".
    OTP_INVALID: 'Mã xác thực không đúng hoặc đã hết hạn',
    RESET_PASSWORD_OK: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại',
  },

  COMPANY: {
    NO_COMPANY: 'Tài khoản chưa gắn với công ty nào',
    NO_ACCESS: 'Bạn không có quyền truy cập công ty này',
    USER_NOT_FOUND: 'Người dùng không tồn tại',
    USER_HAS_COMPANY: 'Người dùng này đã có công ty',
    MST_TAKEN: (email: string) =>
      `Mã số thuế đã được đăng ký tại email: ${email}`,
    NOT_FOUND: 'Công ty không tồn tại',
    RETRY_NOT_FAILED: 'Chỉ cấp lại DB được cho công ty ở trạng thái FAILED',
    SUSPEND_NOT_READY: 'Chỉ tạm khóa được công ty đang hoạt động (READY)',
    RESUME_NOT_SUSPENDED: 'Chỉ mở lại được công ty đang bị khóa (SUSPENDED)',
    NO_TENANT_DB: 'Công ty chưa được cấp DB (provisioning chưa hoàn tất)',
    MST_MISMATCH: 'Mã số thuế xác nhận không khớp với công ty cần xóa',
    TENANT_DB_MISSING:
      'DB tenant không tồn tại (đã bị xóa hoặc cấp chưa xong). Đã đánh dấu FAILED — hãy cấp lại DB.',
    EMAIL_ALREADY_MEMBER: 'Email này đã thuộc một công ty khác',
    INVITE_ALREADY_PENDING: 'Email này đã có lời mời đang chờ duyệt',
    INVITE_NOTIFY_FAILED:
      'Không thể gửi email thông báo cho quản trị viên, vui lòng thử lại',
    INVITE_NOT_FOUND: 'Lời mời không tồn tại',
    INVITE_NOT_PENDING:
      'Lời mời này đã được xử lý (không còn ở trạng thái chờ duyệt)',
    INVITE_WELCOME_MAIL_FAILED:
      'Không thể gửi email mật khẩu cho nhân viên, vui lòng thử lại',
  },

  USER: {
    NOT_FOUND: 'Người dùng không tồn tại',
    CANNOT_DEACTIVATE_SELF: 'Không thể vô hiệu hóa chính tài khoản của bạn',
    CANNOT_CHANGE_OWN_ROLE: 'Không thể đổi vai trò của chính bạn',
    CANNOT_CHANGE_ADMIN:
      'Không thể đổi vai trò tài khoản quản trị hệ thống (thực hiện qua DB)',
    CANNOT_DELETE_SELF: 'Không thể xóa chính tài khoản của bạn',
    CANNOT_DELETE_ADMIN:
      'Không thể xóa tài khoản quản trị hệ thống (thực hiện qua DB)',
    EMAIL_MISMATCH: 'Email xác nhận không khớp',
  },

  SUBSCRIPTION: {
    PLAN_NOT_FOUND: 'Gói dịch vụ không tồn tại',
    PLAN_CODE_TAKEN: 'Mã gói đã tồn tại',
    PLAN_IN_USE:
      'Gói đang hoặc đã được sử dụng nên không xóa được, vui lòng chuyển sang Ngừng bán',
    SUB_NOT_FOUND: 'Thuê bao không tồn tại',
    SAME_PLAN: 'Thuê bao đang dùng đúng gói này',
    ALREADY_CANCELED: 'Thuê bao đã bị hủy',
    CANCELED_CANNOT_RENEW:
      'Thuê bao đã bị hủy nên không gia hạn được, vui lòng đổi gói để kích hoạt lại',
    MST_LIMIT_REACHED: 'Gói hiện tại đã đạt giới hạn số công ty/MST được tạo',
    USER_LIMIT_REACHED: 'Gói hiện tại đã đạt giới hạn số nhân viên',
    MODULE_NOT_INCLUDED: 'Gói đăng ký hiện tại không bao gồm tính năng này',
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

  HRM: {
    NHAN_VIEN_NOT_FOUND: 'Không tìm thấy nhân viên',
    NGUOI_PHU_THUOC_NOT_FOUND: 'Không tìm thấy người phụ thuộc',
    TAI_LIEU_NOT_FOUND: 'Không tìm thấy tài liệu',
    /**
     * E-hrm-037 (404) — dòng giấy tờ KHÔNG có file nào. Từ QĐ #21 câu này chỉ còn dùng cho
     * đúng ca đó; sai `:fileId` mà dòng vẫn có file khác thì là TAI_LIEU_FILE_NOT_FOUND.
     */
    TAI_LIEU_CHUA_CO_FILE: 'Tài liệu này chưa đính file scan.',
    /**
     * E-hrm-066 (404) — QĐ #21. Xem hoặc gỡ một file KHÔNG thuộc dòng giấy tờ đang thao tác.
     * Phép kiểm này là ranh giới an ninh, không phải chuyện thông báo cho đẹp: thiếu nó thì
     * người có quyền vào công ty gỡ được file của giấy tờ bất kỳ chỉ bằng cách đoán id.
     */
    TAI_LIEU_FILE_NOT_FOUND: 'Không tìm thấy file scan này trong giấy tờ đã chọn.',
    /** E-hrm-065 (409) — QĐ #21, BR-hrm-037. Trần 20 file mỗi dòng giấy tờ. */
    TAI_LIEU_QUA_NHIEU_FILE:
      'Mỗi giấy tờ giữ tối đa 20 file. Gỡ bớt file cũ rồi thử lại.',
    HOP_DONG_NOT_FOUND: 'Không tìm thấy hợp đồng',
    DRIVE_CHUA_KET_NOI:
      'Công ty chưa kết nối Google Drive — bấm "Thêm file" để đăng nhập Google và kết nối.',
    DRIVE_CAN_KET_NOI_LAI:
      'Kết nối Google Drive đã hết hiệu lực (bị thu hồi quyền), vui lòng kết nối lại.',
    DRIVE_DOI_TAI_KHOAN_CHI_OWNER:
      'Công ty đã kết nối Google Drive. Chỉ chủ tài khoản mới đổi được sang tài khoản Google khác, vì việc đó chuyển toàn bộ file scan sau này sang Drive mới.',
    DRIVE_NGAT_CHI_OWNER:
      'Chỉ chủ tài khoản mới ngắt được kết nối Google Drive của công ty.',
    // KHÔNG khẳng định "đã bị xóa": Drive trả 404 cho cả trường hợp file vẫn còn nguyên nhưng
    // nằm ở tài khoản Google đã kết nối TRƯỚC ĐÂY (quyền drive.file chỉ thấy file do chính app
    // tạo, trong chính tài khoản đó). Nói chắc là xóa mất sẽ làm khách tưởng mất giấy tờ thật.
    DRIVE_FILE_KHONG_MO_DUOC:
      'Không mở được file trên Google Drive. Có thể file đã bị xóa, hoặc nó nằm ở tài khoản Google mà công ty từng kết nối trước đây. Vui lòng kiểm tra tài khoản Drive đang kết nối, hoặc tải lại file scan.',
    DRIVE_LOI_GOOGLE:
      'Google Drive đang không phản hồi đúng nên chưa xử lý được file scan. Vui lòng thử lại sau ít phút; nếu vẫn lỗi, báo quản trị viên kiểm tra cấu hình Google Drive.',
    DRIVE_KHONG_KET_NOI_DUOC:
      'Máy chủ không kết nối được tới Google nên chưa xử lý được file scan. Đây là sự cố mạng phía máy chủ, không phải do dữ liệu bạn nhập — vui lòng thử lại sau ít phút hoặc báo quản trị viên.',
    /**
     * E-hrm-058 (403) — QĐ #8, BR-hrm-059. Áp cho TOÀN BỘ nhóm `/hrm/hop-dong`.
     * Câu nói rõ đây là chuyện phân quyền và ai cấp được, để người dùng không đi báo lỗi hệ thống.
     */
    KHONG_CO_QUYEN_XEM_LUONG:
      'Bạn không có quyền xem dữ liệu lương và hợp đồng của công ty này. Liên hệ chủ tài khoản để được cấp quyền.',
    PHONG_BAN_NOT_FOUND: 'Không tìm thấy phòng ban',
    PHONG_BAN_ME_NOT_FOUND: 'Phòng ban cha không tồn tại',
    PHONG_BAN_ME_SELF: 'Phòng ban cha không thể là chính nó',
    PHONG_BAN_ME_VONG_LAP:
      'Không thể chọn phòng ban cấp dưới làm phòng ban cha (tạo vòng lặp trong cây tổ chức)',

    // Cấu hình mặc định, Ca làm việc, Lịch ngày lễ (E-hrm-067..E-hrm-079)
    WORK_SHIFT_NOT_FOUND: 'Không tìm thấy ca làm việc',
    HOLIDAY_NOT_FOUND: 'Không tìm thấy ngày lễ',
    WORK_SHIFT_IN_USE: 'Ca làm việc đang được sử dụng trong hệ thống, không thể xóa.',

    GIO_CONG_CHUAN_INVALID:
      'Giờ công chuẩn/ngày phải nằm trong khoảng từ 1.0 đến 24.0 giờ.',
    LUONG_CO_SO_HOAC_VUNG_INVALID:
      'Lương cơ sở và lương tối thiểu vùng phải là số nguyên lớn hơn 0.',
    THUE_TNCN_KHONG_LUY_TIEN:
      'Thuế suất của bậc thuế sau phải lớn hơn bậc liền trước.',
    TEN_CA_LAM_VIEC_EMPTY: 'Tên ca làm việc không được để trống.',
    GIO_VAO_RA_INVALID:
      'Ca làm việc bắt buộc phải có giờ vào và giờ ra hợp lệ (định dạng HH:mm).',
    NGHI_GIUA_CA_HOAC_GIO_CONG_INVALID:
      'Thời gian nghỉ giữa ca không được âm và tổng giờ công thực tế phải lớn hơn 0.',
    MA_CA_LAM_VIEC_EXISTED:
      'Mã ca làm việc đã tồn tại trong công ty. Vui lòng chọn mã khác.',
    TEN_NGAY_LE_HOAC_NGAY_EMPTY:
      'Tên ngày lễ và ngày diễn ra không được để trống.',
    LE_AM_LICH_KHONG_THE_LAP_LAI:
      'Ngày lễ âm lịch không thể lặp lại theo dương lịch. Vui lòng tắt cờ lặp hàng năm và tạo cho từng năm.',
    NGAY_LE_TRUNG_LAP: 'Ngày này đã có ngày lễ cùng tên trong hệ thống.',
    CAN_QUYEN_ADMIN_HOAC_OWNER:
      'Chỉ Quản trị viên (ADMIN) hoặc Chủ doanh nghiệp (OWNER) mới có quyền cập nhật hoặc khôi phục Cấu hình mặc định.',
    GIOI_HAN_99_CA_TU_SINH:
      'Đã đạt giới hạn 99 ca làm việc tự sinh. Vui lòng tự nhập mã ca hoặc giải phóng ca không sử dụng.',
    /** E-hrm-079 — dải năm hợp lệ của "Tạo nhanh lịch ngày lễ" (BR-hrm-079). */
    NAM_KHOI_TAO_LE_INVALID:
      'Năm khởi tạo ngày lễ phải nằm trong khoảng từ 2024 đến 2030.',

    /*
     * Ba mã toàn vẹn biểu thuế TNCN — BR-hrm-082 (BA chốt QĐ #25), wording lấy nguyên văn từ
     * `docs/hrm/srs/hrm-spec.md` Mục 8.10 và `api-contract.md` Mục 8.11.
     */
    NGUONG_THUE_KHONG_TANG:
      'Ngưỡng thu nhập của bậc thuế sau phải lớn hơn bậc liền trước.',
    BIEU_THUE_TOI_THIEU_2_BAC:
      'Biểu thuế thu nhập cá nhân phải có ít nhất 2 bậc.',
    BAC_THUE_CUOI_PHAI_MO:
      'Bậc thuế cuối cùng phải áp cho toàn bộ phần thu nhập vượt bậc liền trước.',

    /** Hết lượt thử cấp mã ca tự sinh vì có người khác chiếm mất — ADR-001 (retry-on-P2002). */
    HE_THONG_BAN_CAP_MA_CA: 'Hệ thống đang bận cấp mã ca, vui lòng bấm lưu lại.',

    // Cài đặt lương: Danh mục khoản lương, Cấu trúc lương & Set lương (E-sal-001..E-sal-011)
    SALARY_ITEM_NOT_FOUND: 'Khoản lương không tồn tại',
    SALARY_ITEM_NAME_EMPTY: 'Tên khoản lương không được để trống',
    SALARY_ITEM_NAME_EXISTED: (tenKhoan: string) =>
      `Đã có khoản tên "${tenKhoan}" trong loại này.`,
    SALARY_ITEM_IN_USE:
      'Khoản lương đang được sử dụng trong cấu trúc lương hoặc nhân viên, không thể xóa.',
    SALARY_STRUCTURE_EMPTY: 'Cấu trúc lương phải có ít nhất một khoản.',
    SALARY_STRUCTURE_DATES_INVALID:
      'Ngày kết thúc hiệu lực phải sau ngày bắt đầu.',
    SALARY_EMPLOYEE_NOT_FOUND: 'Nhân viên không tồn tại',
    SALARY_EMPLOYEE_NO_ACTIVE_CONTRACT:
      'Nhân viên không còn Hợp đồng hiệu lực tại thời điểm hiện tại.',
    SALARY_ITEM_NOT_IN_STRUCTURE: (tenKhoan: string, maKhoan: string) =>
      `Khoản lương "${tenKhoan}" (${maKhoan}) không thuộc cấu trúc lương khung hiện hành.`,
    SALARY_TOTAL_AMOUNT_INVALID: 'Tổng lương phải lớn hơn 0.',
    SALARY_DUPLICATE_ITEMS: 'Danh sách khoản lương gửi lên bị trùng lặp.',
    GIOI_HAN_99_KHOAN_LUONG: 'Đã đạt giới hạn 99 khoản lương tự sinh.',
  },

  VALIDATION: {
    INVALID_MST: 'Mã số thuế không hợp lệ',
    INVALID_NAME: 'Họ tên không hợp lệ',
    INVALID_OTP: `Mã xác thực phải gồm ${OTP_LENGTH} chữ số`,
    INVALID_PHONE: 'Số điện thoại không hợp lệ',
    PASSWORD_MIN: 'Mật khẩu tối thiểu 8 ký tự',
    PASSWORD_LETTER: 'Phải có chữ',
    PASSWORD_NUMBER: 'Phải có số',
  },
} as const;

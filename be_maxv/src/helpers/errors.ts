import { MESSAGES } from '../constants/messages';

/** Lỗi nghiệp vụ có chủ đích (errorHandler.plugin ánh xạ -> HTTP status). */
class AppError extends Error {
  // `options` để chuyền `{ cause }` xuống Error gốc: giữ được nguyên nhân tầng dưới trong log
  // khi mình bọc lại lỗi của thư viện/dịch vụ ngoài.
  constructor(name: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = name;
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('ConflictError', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NotFoundError', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super('UnauthorizedError', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super('ForbiddenError', message);
  }
}

export class ValidationError extends AppError {
  constructor(public readonly details: unknown) {
    super('ValidationError', MESSAGES.COMMON.VALIDATION_FAILED);
  }
}

/** Gửi email (thông báo nghiệp vụ) thất bại — errorHandler ánh xạ -> 502. */
export class MailError extends AppError {
  constructor(message: string) {
    super('MailError', message);
  }
}

/**
 * Google Drive trả về mã lỗi — errorHandler ánh xạ -> 502 (dịch vụ ngoài hỏng, giống MailError).
 *
 * Đặt ở đây chứ không ở `driveClient.ts` để errorHandler bắt được mà không phải kéo ngược một
 * service nghiệp vụ vào tầng plugin.
 *
 * `status` là mã Google trả, GIỮ NGUYÊN để tầng service phân loại trước khi lỗi bay lên
 * errorHandler: 401 = token bị thu hồi (ngắt kết nối rồi báo kết nối lại), 404 = file đã bị xóa
 * trên Drive. Những trường hợp đó service tự đổi sang lỗi nghiệp vụ có thông điệp riêng; cái gì
 * còn lọt tới errorHandler mới là sự cố thật của Google hoặc sai cấu hình phía mình.
 *
 * `status = 0` là quy ước riêng: KHÔNG nhận được phản hồi nào (mất mạng, DNS hỏng, tường lửa,
 * hết thời gian chờ) nên không có mã HTTP để ghi. Số 0 được chọn có chủ đích để nằm ngoài mọi
 * khoảng mà tầng service đang xét (`>= 400 && < 500`, `=== 404`) — sự cố mạng tạm thời KHÔNG
 * được phép bị hiểu nhầm thành "khách đã thu hồi quyền" rồi tự ngắt kết nối Drive của họ.
 */
export class DriveApiError extends AppError {
  /**
   * Mã lỗi máy-đọc-được Google trả kèm (vd `invalid_grant`, `invalid_client`, `rateLimitExceeded`).
   *
   * Có vì mã HTTP KHÔNG đủ để phân biệt: khách gỡ quyền trong tài khoản Google và người vận hành
   * gõ sai `GOOGLE_CLIENT_SECRET` đều ra 4xx ở cùng một endpoint, nhưng cái đầu phải xóa kết nối
   * đã lưu, còn cái sau thì tuyệt đối không được — xóa là mất refresh token của MỌI công ty.
   *
   * `undefined` khi Google trả body không phải JSON (HTML 5xx qua proxy). Chỗ gọi phải coi
   * "không rõ mã" là KHÔNG khớp, đừng đoán.
   */
  readonly maLoi?: string;

  constructor(
    public readonly status: number,
    message: string,
    options?: ErrorOptions & { maLoi?: string },
  ) {
    super('DriveApiError', message, options);
    this.maLoi = options?.maLoi;
  }
}

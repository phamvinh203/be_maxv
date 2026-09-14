import {
  TO_KHAI_THUE_ERRORS,
  type ToKhaiThueErrorCode,
} from '../../constants/hrm/to_khai_thue/toKhaiThueErrors';
import { AppError } from '../errors';

/**
 * Lỗi nghiệp vụ của sub-cụm Tờ khai thuế TNCN — mang mã `E-tkt-xxx` ra tới client.
 *
 * Cùng khuôn `PayrollError` (`helpers/hrm/payrollErrors.ts`) và được `errorHandler.plugin` xử lý
 * ở CÙNG một nhánh, khác đúng một điểm: HTTP status lấy từ bảng mã chứ không truyền vào — xem lý
 * do ở `constants/hrm/to_khai_thue/toKhaiThueErrors.ts`.
 */
export class ToKhaiThueError extends AppError {
  public readonly code: ToKhaiThueErrorCode;
  public readonly statusCode: number;

  constructor(code: ToKhaiThueErrorCode, customMessage?: string) {
    const { status, message } = TO_KHAI_THUE_ERRORS[code];
    super('ToKhaiThueError', customMessage ?? message);
    this.code = code;
    this.statusCode = status;
  }
}

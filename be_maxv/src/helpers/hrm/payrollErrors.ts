import { HttpStatus } from '../../constants/httpStatus';
import {
  PAYROLL_ERROR_MESSAGES,
  type PayrollErrorCode,
} from '../../constants/hrm/payrollErrors';
import { AppError } from '../errors';

/**
 * Lỗi nghiệp vụ chuyên biệt cho Phân hệ Dữ liệu Tính Lương (du_lieu_tinh_luong).
 * Chứa mã lỗi nghiệp vụ chuẩn hóa (E-dltl-xxx) và HTTP status code tương ứng.
 *
 * Kế thừa `AppError` (helpers/errors.ts) như mọi lớp lỗi nghiệp vụ khác trong hệ thống
 * (ConflictError, NotFoundError, MailError, DriveApiError...) thay vì `Error` trực tiếp.
 */
export class PayrollError extends AppError {
  public readonly code: PayrollErrorCode;
  public readonly statusCode: number;

  constructor(
    code: PayrollErrorCode,
    customMessage?: string,
    statusCode: number = HttpStatus.BAD_REQUEST,
  ) {
    const message = customMessage ?? PAYROLL_ERROR_MESSAGES[code] ?? code;
    super('PayrollError', message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

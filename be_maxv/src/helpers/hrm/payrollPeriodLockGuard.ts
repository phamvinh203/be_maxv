import type { PrismaClient } from '../../generated/tenant';
import { PayrollError } from './payrollErrors';
import { PAYROLL_ERROR_CODES } from '../../constants/hrm/payrollErrors';
import { HttpStatus } from '../../constants/httpStatus';

/**
 * Tải kỳ lương chỉ với `id`/`status` — dùng cho MỌI chỗ chỉ cần kiểm tra trạng thái trước khi
 * ghi/chuyển trạng thái (guard này, các hàm chuyển trạng thái ở `payrollPeriods.service.ts`,
 * `getPayrollSheetLines`...), tránh kéo theo `_count` 9 quan hệ mà `getPayrollPeriodById` nạp
 * cho màn danh sách/chi tiết nhưng các chỗ này không dùng tới.
 */
export async function getPayrollPeriodStatusOrThrow(db: PrismaClient, periodId: string) {
  const period = await db.payrollPeriod.findUnique({
    where: { id: periodId },
    select: { id: true, status: true },
  });

  if (!period) {
    throw new PayrollError(
      PAYROLL_ERROR_CODES.E_DLTL_025,
      undefined,
      HttpStatus.NOT_FOUND,
    );
  }

  return period;
}

/** Tải toàn bộ kỳ lương (không kèm `_count`) — dùng khi cần thêm các trường khác ngoài status (vd `year`/`month`/`startDate`/`endDate` cho engine tính lương). */
export async function getPayrollPeriodOrThrow(db: PrismaClient, periodId: string) {
  const period = await db.payrollPeriod.findUnique({ where: { id: periodId } });

  if (!period) {
    throw new PayrollError(
      PAYROLL_ERROR_CODES.E_DLTL_025,
      undefined,
      HttpStatus.NOT_FOUND,
    );
  }

  return period;
}

/**
 * Kiểm tra trạng thái kỳ lương trước khi thực hiện tác vụ ghi (POST/PUT/PATCH/DELETE).
 * Tuân thủ Bất biến Khóa sổ (BR-dltl-001):
 * - Nếu kỳ không tồn tại: Ném lỗi E-dltl-025 (404 Not Found).
 * - Nếu kỳ ở trạng thái LOCKED, APPROVED, PAID, ARCHIVED: Ném lỗi E-dltl-001 (403 Forbidden).
 * - Chỉ cho phép ghi khi kỳ ở trạng thái DRAFT hoặc PENDING_REVIEW.
 */
export async function assertPayrollPeriodWritable(
  db: PrismaClient,
  periodId: string,
) {
  const period = await getPayrollPeriodStatusOrThrow(db, periodId);

  const readOnlyStatuses = ['LOCKED', 'APPROVED', 'PAID', 'ARCHIVED'];
  if (readOnlyStatuses.includes(period.status)) {
    throw new PayrollError(
      PAYROLL_ERROR_CODES.E_DLTL_001,
      undefined,
      HttpStatus.FORBIDDEN,
    );
  }

  return period;
}

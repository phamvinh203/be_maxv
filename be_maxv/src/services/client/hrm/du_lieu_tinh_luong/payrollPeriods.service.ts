import type { PrismaClient, PayrollPeriodStatus } from '../../../../generated/tenant';
import { ConflictError, BadRequestError } from '../../../../helpers/errors';
import { PayrollError } from '../../../../helpers/payrollErrors';
import { PAYROLL_ERROR_CODES } from '../../../../constants/payrollErrors';
import { HttpStatus } from '../../../../constants/httpStatus';
import {
  getPayrollPeriodOrThrow,
  getPayrollPeriodStatusOrThrow,
} from '../../../../helpers/payrollPeriodLockGuard';
import type {
  CreatePayrollPeriodInput,
  ListPayrollPeriodsQuery,
  UpdatePayrollPeriodInput,
} from '../../../../validators/hrm/du_lieu_tinh_luong/payrollPeriods.validator';
import { snapshotPayrollSheet } from './payrollCalculation.service';

/** Đếm số bản ghi phát sinh của kỳ theo từng phân hệ — dùng cho màn danh sách/chi tiết kỳ lương. */
const PAYROLL_PERIOD_MODULE_COUNTS = {
  _count: {
    select: {
      attendanceRecords: true,
      overtimeRecords: true,
      kpiRecords: true,
      bonusRecords: true,
      pieceworkRecords: true,
      commissionRecords: true,
      diligenceRecords: true,
      adjustmentRecords: true,
      payrollSheetLines: true,
    },
  },
} as const;

export async function listPayrollPeriods(db: PrismaClient, query: ListPayrollPeriodsQuery) {
  const where: any = {};
  if (query.year) {
    where.year = query.year;
  }
  if (query.status) {
    where.status = query.status as PayrollPeriodStatus;
  }

  return db.payrollPeriod.findMany({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: PAYROLL_PERIOD_MODULE_COUNTS,
  });
}

export async function getPayrollPeriodById(db: PrismaClient, id: string) {
  const period = await db.payrollPeriod.findUnique({
    where: { id },
    include: PAYROLL_PERIOD_MODULE_COUNTS,
  });

  if (!period) {
    throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_025, undefined, HttpStatus.NOT_FOUND);
  }

  return period;
}

export async function createPayrollPeriod(db: PrismaClient, input: CreatePayrollPeriodInput) {
  const code = `${input.year}-${String(input.month).padStart(2, '0')}`;

  const existing = await db.payrollPeriod.findUnique({
    where: { code },
  });

  if (existing) {
    throw new ConflictError(`Kỳ tính lương ${code} đã tồn tại trong hệ thống.`);
  }

  const startDate = new Date(Date.UTC(input.year, input.month - 1, 1));
  const endDate = new Date(Date.UTC(input.year, input.month, 0));

  return db.payrollPeriod.create({
    data: {
      code,
      name: input.name,
      month: input.month,
      year: input.year,
      startDate,
      endDate,
      status: 'DRAFT',
    },
  });
}

export async function updatePayrollPeriod(db: PrismaClient, id: string, input: UpdatePayrollPeriodInput) {
  const period = await getPayrollPeriodStatusOrThrow(db, id);

  if (period.status !== 'DRAFT') {
    throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_001, undefined, HttpStatus.FORBIDDEN);
  }

  return db.payrollPeriod.update({
    where: { id },
    data: input,
  });
}

export async function deletePayrollPeriod(db: PrismaClient, id: string) {
  const period = await getPayrollPeriodStatusOrThrow(db, id);

  if (period.status !== 'DRAFT') {
    throw new PayrollError(
      PAYROLL_ERROR_CODES.E_DLTL_001,
      'Chỉ có thể xóa kỳ lương ở trạng thái Nháp (DRAFT).',
      HttpStatus.FORBIDDEN,
    );
  }

  return db.payrollPeriod.delete({
    where: { id },
  });
}

export async function submitPayrollPeriod(db: PrismaClient, id: string) {
  const period = await getPayrollPeriodStatusOrThrow(db, id);

  if (period.status !== 'DRAFT') {
    throw new BadRequestError('Chỉ có thể gửi đối soát kỳ lương từ trạng thái DRAFT.');
  }

  return db.payrollPeriod.update({
    where: { id },
    data: { status: 'PENDING_REVIEW' },
  });
}

export async function rejectPayrollPeriod(db: PrismaClient, id: string) {
  const period = await getPayrollPeriodStatusOrThrow(db, id);

  if (period.status !== 'PENDING_REVIEW') {
    throw new BadRequestError('Chỉ có thể từ chối đối soát kỳ lương từ trạng thái PENDING_REVIEW.');
  }

  return db.payrollPeriod.update({
    where: { id },
    data: { status: 'DRAFT' },
  });
}

/**
 * Khóa sổ kỳ lương: Chuyển sang LOCKED và chốt snapshot bảng lương vào PayrollSheetLine.
 *
 * `userId` BẮT BUỘC (không còn optional) — RVW-002: trước đây tham số optional cho phép
 * `undefined` lọt qua âm thầm khi controller gửi lên `(req.user as any)?.sub` (luôn undefined).
 * Bắt buộc tại chữ ký hàm biến lỗi runtime cũ thành lỗi biên dịch nếu tái diễn.
 */
export async function lockPayrollPeriod(db: PrismaClient, id: string, userId: string) {
  // Tải đầy đủ (không chỉ status) vì snapshotPayrollSheet bên dưới cần year/month/startDate/
  // endDate — truyền thẳng xuống để tránh tải lại đúng kỳ lương này lần 2 bên trong transaction.
  const period = await getPayrollPeriodOrThrow(db, id);

  if (period.status !== 'PENDING_REVIEW' && period.status !== 'DRAFT') {
    throw new BadRequestError('Chỉ có thể khóa sổ kỳ lương từ trạng thái DRAFT hoặc PENDING_REVIEW.');
  }

  return db.$transaction(async (tx) => {
    // Chốt snapshot 18 cột
    await snapshotPayrollSheet(tx as unknown as PrismaClient, id, period);

    return tx.payrollPeriod.update({
      where: { id },
      data: {
        status: 'LOCKED',
        lockedByUserId: userId,
        lockedAt: new Date(),
      },
    });
  });
}

/**
 * Mở lại kỳ tính lương (Reopen): role-guard ADMIN/OWNER gắn ở tầng route
 * (`payrollPeriods.route.ts`, `assertAdminOrOwner`); lý do >= 20 ký tự đã được validate ở
 * validator (BR-dltl-001) và được controller ghi vào audit log qua `writeLog` — service chỉ
 * còn lo chuyển trạng thái, không cần nhận `input`/`userId` nữa (BUG-dltl-003/004 đã đóng ở
 * tầng route + controller).
 */
export async function reopenPayrollPeriod(db: PrismaClient, id: string) {
  const period = await getPayrollPeriodStatusOrThrow(db, id);

  if (period.status !== 'LOCKED') {
    throw new BadRequestError('Chỉ có thể mở lại kỳ lương đã ở trạng thái LOCKED.');
  }

  return db.payrollPeriod.update({
    where: { id },
    data: {
      status: 'DRAFT',
      lockedByUserId: null,
      lockedAt: null,
    },
  });
}

export async function approvePayrollPeriod(db: PrismaClient, id: string, userId: string) {
  const period = await getPayrollPeriodStatusOrThrow(db, id);

  if (period.status !== 'LOCKED') {
    throw new BadRequestError('Chỉ có thể phê duyệt kỳ lương khi đã khóa sổ (LOCKED).');
  }

  return db.payrollPeriod.update({
    where: { id },
    data: {
      status: 'APPROVED',
      approvedByUserId: userId,
      approvedAt: new Date(),
    },
  });
}

export async function markPaidPayrollPeriod(db: PrismaClient, id: string) {
  const period = await getPayrollPeriodStatusOrThrow(db, id);

  if (period.status !== 'APPROVED') {
    throw new BadRequestError('Chỉ có thể đánh dấu đã thanh toán khi kỳ lương đã được APPROVED.');
  }

  return db.payrollPeriod.update({
    where: { id },
    data: { status: 'PAID' },
  });
}

export async function archivePayrollPeriod(db: PrismaClient, id: string) {
  const period = await getPayrollPeriodStatusOrThrow(db, id);

  if (period.status !== 'PAID') {
    throw new BadRequestError('Chỉ có thể lưu trữ kỳ lương khi đã PAID.');
  }

  return db.payrollPeriod.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  });
}

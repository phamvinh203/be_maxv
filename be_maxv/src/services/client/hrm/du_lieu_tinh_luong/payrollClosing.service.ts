import type { PayrollModuleCode, PrismaClient } from '../../../../generated/tenant';
import { PayrollError } from '../../../../helpers/hrm/payrollErrors';
import { PAYROLL_ERROR_CODES } from '../../../../constants/hrm/payrollErrors';
import { HttpStatus } from '../../../../constants/httpStatus';
import {
  PAYROLL_MODULES,
  PAYROLL_MODULE_CODES,
  laBangKeDuLieuKy,
  nhanBangKe,
} from '../../../../constants/hrm/payrollModules';
import {
  KY_LUONG_CON_MO,
  assertPayrollPeriodWritable,
  getPayrollPeriodOrThrow,
  khoaKyDeChotSo,
  kyLuongConMo,
} from '../../../../helpers/hrm/payrollPeriodLockGuard';
import { buildActiveEmployeeWhere } from '../../../../utils/du_lieu_tinh_luong/payrollAggregation.util';
import { calculatePayrollPreview, ghiDeBangLuong } from './payrollCalculation.service';
import { chuyenTrangThai } from './payrollPeriods.service';

/**
 * Màn "Chốt kỳ lương" (BR-dltl-030…034): chốt số từng bảng kê, chốt toàn kỳ, tính lương.
 *
 * Chốt số bảng kê KHÁC khóa sổ kỳ: khóa sổ (`lockPayrollPeriod`) đổi trạng thái kỳ + chụp bảng
 * lương; chốt số chỉ đóng băng MỘT bảng kê trong lúc kỳ còn mở để các bảng kê khác nhập tiếp. Khóa
 * sổ không bắt buộc đã chốt đủ 12 bảng kê (chủ dự án chốt 2026-09-11) — kỳ đã khóa sổ thì mọi
 * bảng kê coi như đã chốt theo kỳ, muốn mở chốt phải mở lại kỳ trước.
 */

const KY_DA_KHOA_SO = 'Kỳ lương đã khóa sổ — mọi bảng kê đã được chốt theo kỳ.';

export async function getPayrollClosingOverview(db: PrismaClient, periodId: string) {
  // Cả 4 lượt đọc chỉ cần `periodId` -> chạy song song; kỳ không tồn tại vẫn ra 404.
  const [period, locks, calculatedEmployees, totalEmployees] = await Promise.all([
    getPayrollPeriodOrThrow(db, periodId),
    db.payrollModuleLock.findMany({ where: { periodId } }),
    db.payrollSheetLine.count({ where: { periodId } }),
    // Cùng bộ lọc nhân viên với engine tính lương — "a/b NV" mới so được hai số cùng gốc.
    db.hrm_nhan_vien.count({ where: buildActiveEmployeeWhere({}) }),
  ]);

  const periodLocked = !kyLuongConMo(period.status);
  const lockTheoBangKe = new Map(locks.map((l) => [l.module, l]));

  const modules = PAYROLL_MODULES.map(({ code, label }) => {
    const lock = lockTheoBangKe.get(code);
    // Chốt riêng bảng kê thắng; không chốt riêng mà kỳ đã khóa sổ thì coi như chốt theo kỳ.
    const nguon = lock ?? (periodLocked ? period : null);
    return {
      module: code,
      label,
      periodData: laBangKeDuLieuKy(code),
      locked: nguon !== null,
      lockSource: lock ? ('MODULE' as const) : periodLocked ? ('PERIOD' as const) : null,
      lockedAt: nguon?.lockedAt ?? null,
      lockedByUserId: nguon?.lockedByUserId ?? null,
    };
  });

  return {
    period: {
      id: period.id,
      code: period.code,
      name: period.name,
      month: period.month,
      year: period.year,
      status: period.status,
      lockedAt: period.lockedAt,
    },
    periodLocked,
    modules,
    lockedModuleCount: modules.filter((m) => m.locked).length,
    totalModules: modules.length,
    payroll: { calculatedEmployees, totalEmployees },
  };
}

function laTrungKhoa(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'P2002';
}

export async function lockPayrollModule(
  db: PrismaClient,
  periodId: string,
  module: PayrollModuleCode,
  userId: string,
) {
  await assertPayrollPeriodWritable(db, periodId, KY_DA_KHOA_SO);

  try {
    // Khóa dòng kỳ (FOR UPDATE) trong CÙNG giao dịch với lệnh chốt: lượt ghi dữ liệu bảng kê đang dở
    // (giữ FOR SHARE) phải xong trước, lượt đến sau thấy đã chốt — xem `khoaKyDeGhiDuLieu` (vbsec 2026-09-10).
    return await db.$transaction(async (tx) => {
      await khoaKyDeChotSo(tx, periodId, KY_DA_KHOA_SO);
      return tx.payrollModuleLock.create({
        data: { periodId, module, lockedByUserId: userId },
      });
    });
  } catch (err) {
    // Đã chốt từ trước — hoặc hai người bấm cùng lúc: khóa duy nhất (periodId, module) chặn ở DB.
    if (laTrungKhoa(err)) {
      throw new PayrollError(
        PAYROLL_ERROR_CODES.E_DLTL_028,
        `Bảng kê "${nhanBangKe(module)}" đã được chốt số trước đó.`,
        HttpStatus.CONFLICT,
      );
    }
    throw err;
  }
}

export async function unlockPayrollModule(
  db: PrismaClient,
  periodId: string,
  module: PayrollModuleCode,
) {
  await assertPayrollPeriodWritable(
    db,
    periodId,
    'Kỳ lương đã khóa sổ — mở lại kỳ lương trước khi mở chốt bảng kê.',
  );

  const { count } = await db.payrollModuleLock.deleteMany({ where: { periodId, module } });
  if (count === 0) {
    throw new PayrollError(
      PAYROLL_ERROR_CODES.E_DLTL_028,
      `Bảng kê "${nhanBangKe(module)}" đang mở, không có gì để mở chốt.`,
      HttpStatus.CONFLICT,
    );
  }
  return { module, unlocked: true };
}

/** Chốt mọi bảng kê còn mở trong 1 lần. Trả về đúng các bảng kê VỪA chốt (đã chốt trước đó thì bỏ qua). */
export async function lockAllPayrollModules(db: PrismaClient, periodId: string, userId: string) {
  await assertPayrollPeriodWritable(db, periodId, KY_DA_KHOA_SO);

  // Thử chốt cả 12 trong một câu lệnh; bảng kê đã chốt bị khóa duy nhất bỏ qua. Kết quả chỉ gồm các
  // dòng THỰC SỰ vừa ghi — số liệu ghi nhật ký vẫn đúng khi có người chốt lẻ chen giữa.
  // Cùng khóa dòng kỳ như chốt lẻ (`lockPayrollModule`).
  const vuaChot = await db.$transaction(async (tx) => {
    await khoaKyDeChotSo(tx, periodId, KY_DA_KHOA_SO);
    return tx.payrollModuleLock.createManyAndReturn({
      data: PAYROLL_MODULE_CODES.map((module) => ({ periodId, module, lockedByUserId: userId })),
      skipDuplicates: true,
      select: { module: true },
    });
  });
  const daGhi = new Set(vuaChot.map((l) => l.module));
  return { lockedModules: PAYROLL_MODULE_CODES.filter((code) => daGhi.has(code)) };
}

/**
 * Nút "Tính lương": chạy ĐÚNG engine của bảng lương (pipeline ADR-010) và lưu kết quả tạm của kỳ,
 * ghi đè mỗi lần bấm. Kết quả tạm chỉ phục vụ đếm "Bảng lương a/b NV": màn Bảng lương của kỳ còn mở
 * vẫn tính trực tiếp (`getPayrollSheetLines`), khóa sổ vẫn tính lại lần cuối rồi chụp đè — nên bảng
 * lương chính thức không bao giờ là bản tạm cũ.
 */
export async function calculatePayrollForPeriod(db: PrismaClient, periodId: string) {
  const period = await getPayrollPeriodOrThrow(db, periodId);
  if (!kyLuongConMo(period.status)) {
    throw new PayrollError(
      PAYROLL_ERROR_CODES.E_DLTL_001,
      'Kỳ lương đã khóa sổ — bảng lương đã được chụp lúc khóa sổ, không tính lại.',
      HttpStatus.FORBIDDEN,
    );
  }

  // Tính NGOÀI transaction: engine chạy ~20 truy vấn; để trong transaction là giữ khóa dòng kỳ lương
  // (và một kết nối) suốt lúc tính, dễ đụng timeout 5s mặc định của Prisma.
  const lines = await calculatePayrollPreview(db, periodId, period);

  return db.$transaction(async (tx) => {
    // Ghi có điều kiện lên dòng kỳ TRƯỚC khi ghi đè: giữ khóa dòng tới khi commit nên lượt khóa sổ
    // chen vào phải chờ; kỳ vừa bị khóa sổ trong lúc tính -> 409, không đè bảng lương vừa chụp.
    await chuyenTrangThai(tx, periodId, KY_LUONG_CON_MO, { updatedAt: new Date() });
    await ghiDeBangLuong(tx as unknown as PrismaClient, periodId, lines);
    return { calculatedEmployees: lines.length };
  });
}

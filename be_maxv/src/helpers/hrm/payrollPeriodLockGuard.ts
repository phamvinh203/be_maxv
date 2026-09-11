import type { PayrollPeriodStatus, Prisma, PrismaClient } from '../../generated/tenant';
import { PayrollError } from './payrollErrors';
import { PAYROLL_ERROR_CODES } from '../../constants/hrm/payrollErrors';
import type { PayrollPeriodDataModule } from '../../constants/hrm/payrollModules';
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
 * Trạng thái kỳ còn nhập liệu / chốt số được (BR-dltl-001) — MỘT nguồn cho guard ghi dữ liệu, màn
 * "Chốt kỳ lương" và phép ghi có điều kiện của nút "Tính lương". Thêm trạng thái mới chỉ quyết ở đây.
 */
export const KY_LUONG_CON_MO: readonly PayrollPeriodStatus[] = ['DRAFT', 'PENDING_REVIEW'];

export function kyLuongConMo(status: PayrollPeriodStatus): boolean {
  return KY_LUONG_CON_MO.includes(status);
}

function kiemKyConMo(status: PayrollPeriodStatus, thongBao?: string) {
  if (!kyLuongConMo(status)) {
    throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_001, thongBao, HttpStatus.FORBIDDEN);
  }
}

/**
 * Kiểm tra trạng thái kỳ lương trước khi thực hiện tác vụ ghi (POST/PUT/PATCH/DELETE).
 * Tuân thủ Bất biến Khóa sổ (BR-dltl-001):
 * - Nếu kỳ không tồn tại: Ném lỗi E-dltl-025 (404 Not Found).
 * - Nếu kỳ đã khóa sổ trở đi (LOCKED, APPROVED, PAID, ARCHIVED): Ném lỗi E-dltl-001 (403 Forbidden)
 *   — câu mặc định, hoặc `thongBao` khi nơi gọi cần nói rõ hơn.
 * - Chỉ cho phép ghi khi kỳ ở trạng thái DRAFT hoặc PENDING_REVIEW (`KY_LUONG_CON_MO`).
 */
export async function assertPayrollPeriodWritable(
  db: PrismaClient,
  periodId: string,
  thongBao?: string,
) {
  const period = await getPayrollPeriodStatusOrThrow(db, periodId);
  kiemKyConMo(period.status, thongBao);
  return period;
}

/**
 * Đọc trạng thái kỳ TRONG giao dịch và khóa dòng kỳ tới lúc commit (404 nếu không có). Hai chế độ:
 *  - `FOR SHARE` — lượt ghi dữ liệu bảng kê: các lượt ghi không chặn nhau, nhưng mọi thao tác đổi dòng kỳ
 *    (khóa sổ, phê duyệt… đều là UPDATE) phải chờ lượt ghi commit; lượt ghi đến sau thấy trạng thái mới.
 *  - `FOR UPDATE` — chốt số bảng kê: chèn dòng `hrm_payroll_module_locks` KHÔNG đụng dòng kỳ nên nếu không
 *    khóa thì chẳng chờ ai; khóa độc quyền để lượt ghi dữ liệu đang dở phải xong trước.
 * vbsec 2026-09-10: kiểm ngoài giao dịch rồi mới ghi thì khóa sổ / chốt số chen giữa, dữ liệu vẫn lọt vào
 * kỳ đã khóa (bảng lương đã chụp) / bảng kê đã chốt.
 */
async function docKyCoKhoa(
  tx: Prisma.TransactionClient,
  periodId: string,
  cheDo: 'SHARE' | 'UPDATE',
): Promise<{ status: PayrollPeriodStatus }> {
  const rows =
    cheDo === 'SHARE'
      ? await tx.$queryRaw<{ status: PayrollPeriodStatus }[]>`
          SELECT status FROM "hrm_payroll_periods" WHERE id = ${periodId} FOR SHARE`
      : await tx.$queryRaw<{ status: PayrollPeriodStatus }[]>`
          SELECT status FROM "hrm_payroll_periods" WHERE id = ${periodId} FOR UPDATE`;
  const ky = rows[0];
  if (!ky) {
    throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_025, undefined, HttpStatus.NOT_FOUND);
  }
  return ky;
}

/**
 * Kiểm QUYẾT ĐỊNH cho lượt ghi dữ liệu bảng kê — gọi ở đầu giao dịch ghi (`FOR SHARE`, xem `docKyCoKhoa`).
 * Cùng luật và cùng thứ tự lỗi với `assertPayrollModuleWritable` (404 -> E-dltl-001 -> E-dltl-027); bản
 * ngoài giao dịch vẫn giữ để báo lỗi sớm, trước các bước đọc/kiểm khác.
 */
export async function khoaKyDeGhiDuLieu(
  tx: Prisma.TransactionClient,
  periodId: string,
  module: PayrollPeriodDataModule,
): Promise<void> {
  const ky = await docKyCoKhoa(tx, periodId, 'SHARE');
  kiemKyConMo(ky.status);
  const daChot = await tx.payrollModuleLock.findUnique({
    where: { periodId_module: { periodId, module } },
    select: { id: true },
  });
  if (daChot) {
    throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_027, undefined, HttpStatus.FORBIDDEN);
  }
}

/** Kiểm quyết định cho chốt số bảng kê — gọi ở đầu giao dịch ghi khóa bảng kê (`FOR UPDATE`). */
export async function khoaKyDeChotSo(
  tx: Prisma.TransactionClient,
  periodId: string,
  thongBao?: string,
): Promise<void> {
  const ky = await docKyCoKhoa(tx, periodId, 'UPDATE');
  kiemKyConMo(ky.status, thongBao);
}

/**
 * Guard ghi của 8 bảng kê có dữ liệu riêng của kỳ (BR-dltl-030): kỳ phải còn ghi được (như
 * `assertPayrollPeriodWritable`) VÀ bảng kê đó chưa bị chốt số trên màn "Chốt kỳ lương".
 * Đã chốt -> 403 `E-dltl-027`. Mọi đường ghi của `/payroll-data/*` phải qua guard này thay cho
 * `assertPayrollPeriodWritable` trơn — chỉ kiểm kỳ thì chốt số từng bảng kê không có tác dụng.
 */
export async function assertPayrollModuleWritable(
  db: PrismaClient,
  periodId: string,
  module: PayrollPeriodDataModule,
) {
  // Hai lượt đọc độc lập -> chạy song song (guard nằm trên MỌI đường ghi, kể cả từng ô chấm công);
  // thứ tự báo lỗi giữ nguyên: 404 -> E-dltl-001 -> E-dltl-027.
  const [period, daChot] = await Promise.all([
    getPayrollPeriodStatusOrThrow(db, periodId),
    db.payrollModuleLock.findUnique({
      where: { periodId_module: { periodId, module } },
      select: { id: true },
    }),
  ]);
  kiemKyConMo(period.status);
  if (daChot) {
    throw new PayrollError(
      PAYROLL_ERROR_CODES.E_DLTL_027,
      undefined,
      HttpStatus.FORBIDDEN,
    );
  }

  return period;
}

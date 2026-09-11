import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '../../generated/tenant';
import { PayrollError } from '../../helpers/hrm/payrollErrors';

/**
 * Chuyển trạng thái kỳ lương (payrollPeriods.service.ts) khi có thao tác CHEN GIỮA lượt đọc và lượt ghi.
 *
 * vbsec 2026-09-10 (MEDIUM, payrollPeriods.service.ts:139): mọi chuyển trạng thái đọc status rồi ghi
 * `update({ where: { id } })` không điều kiện. `reject` (không cần vai trò) chạy song song với `lock` đưa
 * kỳ vừa KHÓA về DRAFT — vòng qua guard ADMIN/OWNER và nhật ký bắt buộc của `reopen` (BR-dltl-002).
 *
 * DB giả tái hiện đúng khe chen giữa một cách tất định: lượt ĐỌC trả trạng thái cũ, còn trạng thái THẬT
 * trong kho đã bị người khác đổi. `updateMany` áp đúng điều kiện `where.status` như Postgres.
 */

let soLanChupSnapshot = 0;

let rejectPayrollPeriod: typeof import('../../services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service').rejectPayrollPeriod;
let approvePayrollPeriod: typeof import('../../services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service').approvePayrollPeriod;
let lockPayrollPeriod: typeof import('../../services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service').lockPayrollPeriod;

before(async () => {
  mock.module('../../services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service', {
    namedExports: {
      snapshotPayrollSheet: async () => {
        soLanChupSnapshot += 1;
      },
    },
  });
  ({ rejectPayrollPeriod, approvePayrollPeriod, lockPayrollPeriod } = await import(
    '../../services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service'
  ));
});

function khopTrangThai(thuc: string, dieuKien: unknown): boolean {
  if (dieuKien === undefined) return true;
  if (typeof dieuKien === 'string') return thuc === dieuKien;
  if (dieuKien && typeof dieuKien === 'object' && 'in' in dieuKien) {
    return (dieuKien as { in: string[] }).in.includes(thuc);
  }
  throw new Error(`DB giả chưa hỗ trợ điều kiện status: ${JSON.stringify(dieuKien)}`);
}

/** `trangThaiDaDoc`: thứ service đọc được (đã cũ); `trangThaiThat`: trạng thái thật lúc ghi. */
function taoDbGia(trangThaiDaDoc: string, trangThaiThat: string) {
  const kho: Record<string, unknown> = {
    id: 'ky-1',
    code: '2026-09',
    year: 2026,
    month: 9,
    status: trangThaiThat,
    lockedByUserId: null,
    lockedAt: null,
    approvedByUserId: null,
    approvedAt: null,
  };
  const payrollPeriod = {
    findUnique: async () => ({ ...kho, status: trangThaiDaDoc }),
    findUniqueOrThrow: async () => ({ ...kho }),
    update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(kho, data),
    updateMany: async ({ where, data }: { where: { status?: unknown }; data: Record<string, unknown> }) => {
      if (!khopTrangThai(kho.status as string, where.status)) return { count: 0 };
      Object.assign(kho, data);
      return { count: 1 };
    },
  };
  const db = {
    payrollPeriod,
    $transaction: async (fn: (tx: unknown) => unknown) => fn({ payrollPeriod }),
  } as unknown as PrismaClient;
  return { kho, db };
}

test('reject chen sau lock: đọc PENDING_REVIEW nhưng kỳ vừa bị KHÓA -> 409, kỳ vẫn LOCKED', async () => {
  const { kho, db } = taoDbGia('PENDING_REVIEW', 'LOCKED');

  await assert.rejects(rejectPayrollPeriod(db, 'ky-1'), PayrollError);
  assert.equal(kho.status, 'LOCKED');
});

test('approve chen sau reopen: đọc LOCKED nhưng kỳ vừa mở lại DRAFT -> 409, không ghi người duyệt', async () => {
  const { kho, db } = taoDbGia('LOCKED', 'DRAFT');

  await assert.rejects(approvePayrollPeriod(db, 'ky-1', 'owner-1'), PayrollError);
  assert.equal(kho.status, 'DRAFT');
  assert.equal(kho.approvedByUserId, null);
});

test('lock chen sau lock khác: đọc DRAFT nhưng kỳ đã KHÓA -> 409, không chụp snapshot lần 2', async () => {
  soLanChupSnapshot = 0;
  const { kho, db } = taoDbGia('DRAFT', 'LOCKED');

  await assert.rejects(lockPayrollPeriod(db, 'ky-1', 'owner-2'), PayrollError);
  assert.equal(soLanChupSnapshot, 0);
  assert.equal(kho.lockedByUserId, null);
});

test('không có ai chen: reject PENDING_REVIEW -> DRAFT bình thường', async () => {
  const { kho, db } = taoDbGia('PENDING_REVIEW', 'PENDING_REVIEW');

  const ketQua = await rejectPayrollPeriod(db, 'ky-1');
  assert.equal(ketQua.status, 'DRAFT');
  assert.equal(kho.status, 'DRAFT');
});

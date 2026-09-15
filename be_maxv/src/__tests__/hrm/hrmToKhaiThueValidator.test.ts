import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIncomeCategoryBodySchema } from '../../validators/hrm/to_khai_thue/incomeCategory.validator';
import { createOtherIncomeBodySchema } from '../../validators/hrm/to_khai_thue/otherIncomeRecord.validator';

/**
 * Biên đầu vào của sub-cụm `to_khai_thue` (RVW-723, RVW-724): số hoặc ngày ngoài miền phải dừng ở 400 có mã, không
 * lọt xuống Postgres (tràn cột) hay Prisma (Date hỏng) thành 500 vô danh.
 */

const KHOAN = {
  periodId: 'p-9',
  fullName: 'Nguyễn Văn Hùng',
  otherIncomeCategoryId: 'dm-12',
  paymentDate: '2026-09-10',
  amount: 6_000_000,
};

const khoanHopLe = (than: Record<string, unknown>) =>
  createOtherIncomeBodySchema.safeParse({ ...KHOAN, ...than }).success;

test('RVW-723: amount phải là số nguyên đồng, lớn hơn 0 và dưới 1.000 tỷ', () => {
  for (const amount of [0.004, 1_500_000.5, 0, -1, 1_000_000_000_000]) {
    assert.equal(khoanHopLe({ amount }), false, `amount=${amount}`);
  }
  assert.equal(khoanHopLe({ amount: 999_999_999_999 }), true);
});

test('RVW-724: ngày chi trả / ngày chứng từ khấu trừ phải là ngày CÓ THẬT — không cuộn sang tháng sau', () => {
  for (const d of ['2026-02-31', '2026-09-31', '2026-13-45', '2026-9-10']) {
    assert.equal(khoanHopLe({ paymentDate: d }), false, `paymentDate=${d}`);
    assert.equal(
      khoanHopLe({ eWithholdingCertDate: d }),
      false,
      `eWithholdingCertDate=${d}`,
    );
  }
  assert.equal(
    khoanHopLe({ paymentDate: '2028-02-29', eWithholdingCertDate: null }),
    true,
    'ngày 29/02 năm nhuận là ngày có thật',
  );
});

test('RVW-723: trần miễn thuế / ngưỡng khấu trừ không vượt cột Decimal(15,2)', () => {
  const danhMucHopLe = (than: Record<string, unknown>) =>
    createIncomeCategoryBodySchema.safeParse({ name: 'QA', ...than }).success;
  const tran = { taxTreatmentGroup: 'EXEMPT_CAPPED', exemptCapPeriod: 'MONTHLY' };
  const khauTru = { taxTreatmentGroup: 'WITHHOLDING_FLAT' };

  assert.equal(danhMucHopLe({ ...tran, exemptCapAmount: 10_000_000_000_000 }), false);
  assert.equal(danhMucHopLe({ ...tran, exemptCapAmount: 9_999_999_999_999 }), true);
  assert.equal(danhMucHopLe({ ...khauTru, withholdingThreshold: 10_000_000_000_000 }), false);
  assert.equal(danhMucHopLe({ ...khauTru, withholdingThreshold: 9_999_999_999_999 }), true);
});

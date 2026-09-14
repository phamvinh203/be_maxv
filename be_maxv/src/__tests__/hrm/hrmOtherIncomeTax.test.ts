import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tinhThueThuNhapNgoaiLuong,
  type DauVaoTinhThue,
  type ThamSoDanhMuc,
} from '../../services/client/hrm/to_khai_thue/otherIncomeTax';
import { khoaNguoiNhan } from '../../services/client/hrm/to_khai_thue/otherIncomeRecord.service';
import { ToKhaiThueError } from '../../helpers/hrm/toKhaiThueErrors';

/**
 * Engine thuế của một bản ghi thu nhập ngoài lương — BR-tkt-007 / BR-tkt-008.
 * Bốn nhóm xử lý + các biên: đúng ngưỡng, Cam kết 08, ép khấu trừ, trần đã dùng một phần.
 */

function dm(o: Partial<ThamSoDanhMuc> = {}): ThamSoDanhMuc {
  return {
    taxTreatmentGroup: 'WITHHOLDING_FLAT',
    exemptCapAmount: null,
    exemptCapPeriod: null,
    withholdingRate: 10,
    withholdingThreshold: 5_000_000,
    ...o,
  };
}

function dv(o: Partial<DauVaoTinhThue> = {}): DauVaoTinhThue {
  return {
    amount: 6_000_000,
    paymentType: 'GROSS',
    isResident: true,
    hasCommitment08: false,
    forceWithholding: false,
    daMienTrongKy: 0,
    ...o,
  };
}

/* ── Nhóm miễn toàn bộ ─────────────────────────────────────────────── */

test('EXEMPT_FULL: miễn hết, không khấu trừ, KHÔNG cộng vào thu nhập chịu thuế', () => {
  const kq = tinhThueThuNhapNgoaiLuong(
    dm({
      taxTreatmentGroup: 'EXEMPT_FULL',
      withholdingRate: null,
      withholdingThreshold: null,
    }),
    dv({ amount: 9_000_000 }),
  );
  assert.equal(kq.exemptAmount, 9_000_000);
  assert.equal(kq.taxableAmount, 0, 'không được cộng lũy tiến');
  assert.equal(kq.taxDeducted, 0);
  assert.equal(kq.grossAmount, kq.netAmount, 'không có thuế thì gross = net');
});

/* ── Nhóm miễn có trần ─────────────────────────────────────────────── */

test('EXEMPT_CAPPED / AC-tkt-010: 1.500.000 với trần 1.200.000 -> miễn 1,2tr, 300k chịu thuế', () => {
  const kq = tinhThueThuNhapNgoaiLuong(
    dm({
      taxTreatmentGroup: 'EXEMPT_CAPPED',
      exemptCapAmount: 1_200_000,
      exemptCapPeriod: 'MONTHLY',
      withholdingRate: null,
      withholdingThreshold: null,
    }),
    dv({ amount: 1_500_000 }),
  );
  assert.equal(kq.exemptAmount, 1_200_000);
  assert.equal(kq.taxableAmount, 300_000);
  assert.equal(kq.taxDeducted, 0, 'nhóm này không khấu trừ tại nguồn');
  assert.equal(
    kq.exemptAmount + kq.taxableAmount,
    kq.grossAmount,
    'bất biến của ADR-013',
  );
});

test('EXEMPT_CAPPED: trần tính LŨY KẾ trong kỳ, không phải cho mỗi lần chi', () => {
  const danhMuc = dm({
    taxTreatmentGroup: 'EXEMPT_CAPPED',
    exemptCapAmount: 1_200_000,
    exemptCapPeriod: 'MONTHLY',
    withholdingRate: null,
    withholdingThreshold: null,
  });

  // Lần chi thứ hai trong tháng, đã miễn 1.000.000 ở lần trước.
  const kq = tinhThueThuNhapNgoaiLuong(
    danhMuc,
    dv({ amount: 800_000, daMienTrongKy: 1_000_000 }),
  );
  assert.equal(kq.exemptAmount, 200_000, 'chỉ còn 200k trần chưa dùng');
  assert.equal(kq.taxableAmount, 600_000);
  assert.match(kq.explain, /đã dùng/);

  // Trần đã dùng hết.
  const hetTran = tinhThueThuNhapNgoaiLuong(
    danhMuc,
    dv({ amount: 500_000, daMienTrongKy: 1_200_000 }),
  );
  assert.equal(hetTran.exemptAmount, 0);
  assert.equal(hetTran.taxableAmount, 500_000);
});

/* ── Nhóm chịu thuế toàn bộ ────────────────────────────────────────── */

test('TAXABLE_FULL: cộng toàn bộ vào thu nhập chịu thuế, không khấu trừ riêng', () => {
  const kq = tinhThueThuNhapNgoaiLuong(
    dm({
      taxTreatmentGroup: 'TAXABLE_FULL',
      withholdingRate: null,
      withholdingThreshold: null,
    }),
    dv({ amount: 5_000_000 }),
  );
  assert.equal(kq.taxableAmount, 5_000_000);
  assert.equal(kq.exemptAmount, 0);
  assert.equal(kq.taxDeducted, 0);
  assert.equal(kq.taxDeductionType, 'PROGRESSIVE');
});

test('GAP-QA-tkt-01: TAXABLE_FULL trả theo NET bị CHẶN, không lặng lẽ gán gross = net', () => {
  assert.throws(
    () =>
      tinhThueThuNhapNgoaiLuong(
        dm({
          taxTreatmentGroup: 'TAXABLE_FULL',
          withholdingRate: null,
          withholdingThreshold: null,
        }),
        dv({ amount: 10_000_000, paymentType: 'NET' }),
      ),
    (err: unknown) => {
      assert.ok(err instanceof ToKhaiThueError);
      assert.equal(err.code, 'E-tkt-004');
      assert.match(err.message, /số trước thuế/);
      return true;
    },
  );
});

/* ── Nhóm khấu trừ tại nguồn ───────────────────────────────────────── */

test('WITHHOLDING_FLAT / AC-tkt-012: dưới ngưỡng 5.000.000 -> không khấu trừ', () => {
  const kq = tinhThueThuNhapNgoaiLuong(dm(), dv({ amount: 4_000_000 }));
  assert.equal(kq.taxDeducted, 0);
  assert.equal(kq.taxDeductionType, 'NO_DEDUCTION');
  assert.match(kq.explain, /dưới ngưỡng/);
});

test('WITHHOLDING_FLAT: ĐÚNG ngưỡng 5.000.000 là đã phải khấu trừ (biên >=)', () => {
  const kq = tinhThueThuNhapNgoaiLuong(dm(), dv({ amount: 5_000_000 }));
  assert.equal(kq.taxDeducted, 500_000);
  assert.equal(kq.taxDeductionType, 'FLAT_10');
  assert.equal(kq.netAmount, 4_500_000);
});

test('BR-tkt-008: dưới ngưỡng nhưng cá nhân YÊU CẦU khấu trừ -> vẫn khấu trừ', () => {
  const kq = tinhThueThuNhapNgoaiLuong(
    dm(),
    dv({ amount: 3_000_000, forceWithholding: true }),
  );
  assert.equal(kq.taxDeducted, 300_000);
  assert.match(kq.explain, /yêu cầu khấu trừ/);
});

test('AC-tkt-013: có Cam kết 08 thì tạm không khấu trừ DÙ vượt ngưỡng', () => {
  const kq = tinhThueThuNhapNgoaiLuong(
    dm(),
    dv({ amount: 7_000_000, hasCommitment08: true }),
  );
  assert.equal(kq.taxDeducted, 0);
  assert.equal(kq.taxDeductionType, 'EXEMPT_COMMIT');
});

test('WITHHOLDING_FLAT trả theo NET: quy ngược ra GROSS (thuế suất cố định nên giải được)', () => {
  const kq = tinhThueThuNhapNgoaiLuong(
    dm(),
    dv({ amount: 9_000_000, paymentType: 'NET' }),
  );
  assert.equal(kq.grossAmount, 10_000_000, '9tr / (1 - 10%)');
  assert.equal(kq.taxDeducted, 1_000_000);
  assert.equal(kq.netAmount, 9_000_000);
});

test('Cá nhân không cư trú -> FLAT_20 (khai báo, ngoài phạm vi đợt này)', () => {
  const kq = tinhThueThuNhapNgoaiLuong(dm(), dv({ isResident: false }));
  assert.equal(kq.taxDeductionType, 'FLAT_20');
});

test('Khoản khấu trừ riêng KHÔNG cộng lũy tiến — nếu không là đánh thuế hai lần', () => {
  for (const amount of [3_000_000, 6_000_000]) {
    const kq = tinhThueThuNhapNgoaiLuong(dm(), dv({ amount }));
    assert.equal(kq.taxableAmount, 0, `amount=${amount}`);
  }
});

/* ── Khóa gom người nhận (ADR-013) ─────────────────────────────────── */

test('recipientKey: nhân viên theo mã, vãng lai theo tên chuẩn hóa', () => {
  assert.equal(khoaNguoiNhan('NV0001', 'Nguyễn Văn A'), 'NV0001');
  // Cùng một người vãng lai khai tên lệch hoa/thường và thừa khoảng trắng vẫn phải ra một khóa —
  // nếu không, chỉ tiêu [16] của tờ khai đếm thành hai lao động.
  assert.equal(
    khoaNguoiNhan(null, '  Trần Thị B '),
    khoaNguoiNhan(null, 'trần thị b'),
  );
});

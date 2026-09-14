import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '../../generated/tenant';
import {
  getTaxPolicies,
  resolveTaxPolicy,
  veTaxPolicyDto,
} from '../../services/client/hrm/to_khai_thue/taxPolicy.service';
import { ToKhaiThueError } from '../../helpers/hrm/toKhaiThueErrors';
import { TO_KHAI_THUE_ERRORS } from '../../constants/hrm/to_khai_thue/toKhaiThueErrors';

/**
 * Tra cứu chính sách thuế theo mốc hiệu lực (ADR-012, BR-tkt-017) + hạ tầng mã lỗi `E-tkt-*`.
 *
 * Phép chọn dòng theo ngày do Postgres làm (`lte` + `orderBy desc` + lấy dòng đầu), nên ở đây
 * kiểm hai thứ mã nguồn thật sự chịu trách nhiệm: **hình dạng truy vấn** gửi xuống (sai một chi
 * tiết là lấy nhầm chính sách mà vẫn chạy êm) và **nhánh thiếu dữ liệu**.
 */

function chinhSach(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tp-2026',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    personalDeduction: new Prisma.Decimal(15_500_000),
    dependentDeduction: new Prisma.Decimal(6_200_000),
    taxBrackets: [
      { khoang: 10000000, thueSuat: 5 },
      { khoang: 30000000, thueSuat: 10 },
      { khoang: 60000000, thueSuat: 20 },
      { khoang: 100000000, thueSuat: 30 },
      { khoang: null, thueSuat: 35 },
    ],
    withholdingTaxRate: new Prisma.Decimal(10),
    withholdingTaxThreshold: new Prisma.Decimal(5_000_000),
    voluntaryPensionMonthlyCap: new Prisma.Decimal(3_000_000),
    lunchAllowanceTaxFreeCap: new Prisma.Decimal(1_200_000),
    legalBasisNote: 'Luật 109/2025/QH15',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

test('ADR-012: tra cứu gửi đúng hình dạng truy vấn — mốc <= ngày bắt đầu kỳ, lấy mốc MỚI NHẤT', async () => {
  let doiSo: unknown;
  const db = {
    taxPolicy: {
      findFirst: async (args: unknown) => {
        doiSo = args;
        return chinhSach();
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const ngayBatDauKy = new Date('2026-09-01T00:00:00.000Z');
  const kq = await resolveTaxPolicy(db, ngayBatDauKy);

  assert.deepEqual(doiSo, {
    where: { effectiveFrom: { lte: ngayBatDauKy } },
    orderBy: { effectiveFrom: 'desc' },
  });
  assert.equal(kq.id, 'tp-2026');
});

test('ADR-012: thiếu chính sách -> E-tkt-015 với HTTP 500, KHÔNG lặng lẽ lấy số mặc định', async () => {
  const db = {
    taxPolicy: { findFirst: async () => null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  await assert.rejects(
    () => resolveTaxPolicy(db, new Date('2026-09-01T00:00:00.000Z')),
    (err: unknown) => {
      assert.ok(err instanceof ToKhaiThueError);
      assert.equal(err.code, 'E-tkt-015');
      assert.equal(err.statusCode, 500);
      // Thông điệp phải nêu được ngày và lệnh cần chạy — người trực vận hành đọc là biết làm gì.
      assert.match(err.message, /2026-09-01/);
      assert.match(err.message, /hrm:seed-thue/);
      return true;
    },
  );
});

test('Hợp đồng Mục 0.3: mọi trường tiền trả ra là SỐ, không phải chuỗi Decimal', async () => {
  const dto = veTaxPolicyDto(chinhSach() as never);

  for (const truong of [
    'personalDeduction',
    'dependentDeduction',
    'withholdingTaxRate',
    'withholdingTaxThreshold',
    'voluntaryPensionMonthlyCap',
    'lunchAllowanceTaxFreeCap',
  ] as const) {
    assert.equal(typeof dto[truong], 'number', `${truong} phải là number`);
  }
  assert.equal(dto.personalDeduction, 15_500_000);
  assert.equal(
    dto.effectiveFrom,
    '2026-01-01',
    'ngày ở dạng YYYY-MM-DD, không kèm giờ',
  );
  assert.equal(dto.taxBrackets.length, 5);
  assert.equal(dto.taxBrackets[4].khoang, null, 'bậc cuối là bậc mở');
});

test('GET /tax-policies: sắp xếp mốc mới nhất trước', async () => {
  let doiSo: unknown;
  const db = {
    taxPolicy: {
      findMany: async (args: unknown) => {
        doiSo = args;
        return [
          chinhSach(),
          chinhSach({
            id: 'tp-cu',
            effectiveFrom: new Date('1900-01-01T00:00:00.000Z'),
          }),
        ];
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const ds = await getTaxPolicies(db);
  assert.deepEqual(doiSo, { orderBy: { effectiveFrom: 'desc' } });
  assert.equal(ds.length, 2);
  assert.equal(ds[1].effectiveFrom, '1900-01-01');
});

test('Hạ tầng mã lỗi: đủ 21 mã E-tkt-* và HTTP status khớp SRS Mục 8', () => {
  const ma = Object.keys(TO_KHAI_THUE_ERRORS);
  assert.equal(ma.length, 21, 'SRS quy định đúng 21 mã lỗi');

  // Không mã nào được thiếu: E-tkt-001..021 liên tục, không khe trống.
  for (let i = 1; i <= 21; i++) {
    const code = `E-tkt-${String(i).padStart(3, '0')}`;
    assert.ok(ma.includes(code), `thiếu mã ${code}`);
  }

  // Vài cặp mã–status mà SRS nêu đích danh, chọn mỗi lớp status một đại diện.
  assert.equal(TO_KHAI_THUE_ERRORS['E-tkt-005'].status, 409);
  assert.equal(TO_KHAI_THUE_ERRORS['E-tkt-007'].status, 403);
  assert.equal(TO_KHAI_THUE_ERRORS['E-tkt-015'].status, 500);
  assert.equal(TO_KHAI_THUE_ERRORS['E-tkt-016'].status, 404);
  assert.equal(TO_KHAI_THUE_ERRORS['E-tkt-021'].status, 400);

  // Mọi mã phải có thông điệp tiếng Việt thật, không để trống hay lặp lại chính mã.
  for (const [code, { message }] of Object.entries(TO_KHAI_THUE_ERRORS)) {
    assert.ok(message.length > 20, `${code} thiếu thông điệp nghiệp vụ`);
    assert.ok(
      !message.includes(code),
      `${code} không được lấy chính mã làm thông điệp`,
    );
  }
});

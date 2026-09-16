import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '../../generated/tenant';
import {
  createIncomeCategory,
  deleteIncomeCategory,
  listIncomeCategories,
} from '../../services/client/hrm/to_khai_thue/incomeCategory.service';
import { soatThamSoTheoNhom } from '../../validators/hrm/to_khai_thue/incomeCategory.validator';
import { ToKhaiThueError } from '../../helpers/hrm/toKhaiThueErrors';
import { DANH_MUC_THU_NHAP_SEED } from '../../constants/hrm/to_khai_thue/taxSeedData';

/** Danh mục loại thu nhập ngoài lương — BR-tkt-001…004, AC-tkt-001…005. */

function hang(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dm-1',
    code: 'TN01',
    name: 'Làm thêm giờ / ca đêm',
    taxTreatmentGroup: 'EXEMPT_FULL',
    exemptCapAmount: null,
    exemptCapPeriod: null,
    withholdingRate: null,
    withholdingThreshold: null,
    legalBasisNote: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    _count: { records: 0 },
    ...overrides,
  };
}

/* ── BR-tkt-003: quan hệ nhóm ↔ tham số ───────────────────────────── */

test('BR-tkt-003: mỗi nhóm chỉ nhận đúng tham số của mình', () => {
  // Miễn có trần: bắt buộc có trần, không nhận tham số khấu trừ.
  assert.equal(
    soatThamSoTheoNhom({
      taxTreatmentGroup: 'EXEMPT_CAPPED',
      exemptCapAmount: 1_200_000,
    }),
    null,
  );
  assert.match(
    soatThamSoTheoNhom({ taxTreatmentGroup: 'EXEMPT_CAPPED' }) ?? '',
    /bắt buộc phải có mức trần/,
  );
  assert.match(
    soatThamSoTheoNhom({
      taxTreatmentGroup: 'EXEMPT_CAPPED',
      exemptCapAmount: 1_200_000,
      withholdingRate: 10,
    }) ?? '',
    /không dùng tỷ lệ hay ngưỡng/,
  );

  // Khấu trừ tại nguồn: KHÔNG đòi tỷ lệ/ngưỡng (service điền mặc định), nhưng cấm trần.
  assert.equal(
    soatThamSoTheoNhom({ taxTreatmentGroup: 'WITHHOLDING_FLAT' }),
    null,
  );
  assert.match(
    soatThamSoTheoNhom({
      taxTreatmentGroup: 'WITHHOLDING_FLAT',
      exemptCapAmount: 1_000,
    }) ?? '',
    /không dùng mức trần/,
  );

  // Hai nhóm toàn phần: không nhận tham số nào — tham số thừa gây hiểu nhầm, từ chối thay vì
  // lặng lẽ bỏ qua (hợp đồng Mục 2.3).
  for (const nhom of ['EXEMPT_FULL', 'TAXABLE_FULL'] as const) {
    assert.equal(soatThamSoTheoNhom({ taxTreatmentGroup: nhom }), null);
    assert.match(
      soatThamSoTheoNhom({ taxTreatmentGroup: nhom, exemptCapAmount: 1 }) ?? '',
      /không nhận trần miễn thuế/,
    );
  }
});

/* ── AC-tkt-003: seed lười ─────────────────────────────────────────── */

test('AC-tkt-003: bảng rỗng thì GET tự sinh đủ 12 danh mục chuẩn', async () => {
  const daSeed: Array<{ code: string }> = [];
  const db = {
    otherIncomeCategory: {
      count: async () => 0,
      createMany: async (args: { data: Array<{ code: string }> }) => {
        daSeed.push(...args.data);
        return { count: args.data.length };
      },
      findMany: async () => [hang()],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  await listIncomeCategories(db, {});

  assert.equal(daSeed.length, 12, 'phải seed đủ 12 danh mục khi bảng rỗng');
  assert.deepEqual(
    daSeed.map((d) => d.code),
    DANH_MUC_THU_NHAP_SEED.map((d) => d.code),
  );
});

test('AC-tkt-003: bảng đã có dữ liệu thì KHÔNG seed đè lên công sức của kế toán', async () => {
  let goiCreateMany = false;
  const db = {
    otherIncomeCategory: {
      count: async () => 3,
      createMany: async () => {
        goiCreateMany = true;
        return { count: 0 };
      },
      findMany: async () => [hang()],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  await listIncomeCategories(db, {});
  assert.equal(goiCreateMany, false);
});

/* ── DTO ───────────────────────────────────────────────────────────── */

test('DTO: appliesToInternalOnly tính lúc đọc, tiền là số, usageCount có sẵn', async () => {
  const db = {
    otherIncomeCategory: {
      count: async () => 5,
      findMany: async () => [
        hang({
          code: 'TN09',
          taxTreatmentGroup: 'EXEMPT_CAPPED',
          exemptCapAmount: new Prisma.Decimal(1_200_000),
          exemptCapPeriod: 'MONTHLY',
          _count: { records: 4 },
        }),
        hang({
          id: 'dm-2',
          code: 'TN12',
          taxTreatmentGroup: 'WITHHOLDING_FLAT',
          withholdingRate: new Prisma.Decimal(10),
          withholdingThreshold: new Prisma.Decimal(5_000_000),
        }),
      ],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const [anCa, hoaHong] = await listIncomeCategories(db, {});

  assert.equal(
    anCa.appliesToInternalOnly,
    true,
    'nhóm không phải khấu trừ -> chỉ nội bộ',
  );
  assert.equal(anCa.exemptCapAmount, 1_200_000);
  assert.equal(
    typeof anCa.exemptCapAmount,
    'number',
    'tiền là số, không phải chuỗi Decimal',
  );
  assert.equal(anCa.usageCount, 4);

  assert.equal(
    hoaHong.appliesToInternalOnly,
    false,
    'khấu trừ tại nguồn -> nhận cả vãng lai',
  );
  assert.equal(hoaHong.withholdingThreshold, 5_000_000);
});

/* ── AC-tkt-002: mặc định của nhóm khấu trừ ────────────────────────── */

test('AC-tkt-002: bỏ trống tỷ lệ/ngưỡng thì service điền 10% và 5.000.000', async () => {
  let daGhi: Record<string, unknown> | null = null;
  const db = {
    otherIncomeCategory: {
      findMany: async () => [{ code: 'TN01' }],
      create: async (args: { data: Record<string, unknown> }) => {
        daGhi = args.data;
        return hang({ ...args.data, _count: { records: 0 } });
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  await createIncomeCategory(db, {
    name: 'Thù lao cộng tác viên',
    taxTreatmentGroup: 'WITHHOLDING_FLAT',
  });

  assert.equal(daGhi!.withholdingRate, 10);
  assert.equal(daGhi!.withholdingThreshold, 5_000_000);
  assert.equal(daGhi!.exemptCapAmount, null, 'nhóm này không có trần');
  assert.equal(
    daGhi!.code,
    'TN02',
    'tự cấp mã quét khe trống: TN01 đã dùng -> TN02',
  );
});

test('ADR-001: tự cấp mã nhảy đúng khe trống nhỏ nhất, không phải max+1', async () => {
  let daGhi: Record<string, unknown> | null = null;
  const db = {
    otherIncomeCategory: {
      // TN02 đang trống ở giữa.
      findMany: async () => [
        { code: 'TN01' },
        { code: 'TN03' },
        { code: 'TN04' },
      ],
      create: async (args: { data: Record<string, unknown> }) => {
        daGhi = args.data;
        return hang({ ...args.data, _count: { records: 0 } });
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  await createIncomeCategory(db, {
    name: 'Khoản mới',
    taxTreatmentGroup: 'TAXABLE_FULL',
  });
  assert.equal(daGhi!.code, 'TN02');
});

test('BR-tkt-003: tạo nhóm miễn-có-trần mà thiếu trần -> E-tkt-003, không chạm CSDL', async () => {
  const db = {
    otherIncomeCategory: {
      findMany: async () => {
        throw new Error('không được truy vấn khi đầu vào đã sai');
      },
      create: async () => {
        throw new Error('không được ghi khi đầu vào đã sai');
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  await assert.rejects(
    () =>
      createIncomeCategory(db, {
        name: 'Ăn ca',
        taxTreatmentGroup: 'EXEMPT_CAPPED',
      }),
    (err: unknown) => {
      assert.ok(err instanceof ToKhaiThueError);
      assert.equal(err.code, 'E-tkt-003');
      assert.equal(err.statusCode, 400);
      return true;
    },
  );
});

/* ── BR-tkt-004: chặn xóa ──────────────────────────────────────────── */

test('BR-tkt-004 / AC-tkt-005: đang có bản ghi dùng -> E-tkt-002, nêu số lượng và gợi ý', async () => {
  let daXoa = false;
  const db = {
    otherIncomeCategory: {
      findUnique: async () => hang({ name: 'Ăn trưa', _count: { records: 7 } }),
      delete: async () => {
        daXoa = true;
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  await assert.rejects(
    () => deleteIncomeCategory(db, 'dm-1'),
    (err: unknown) => {
      assert.ok(err instanceof ToKhaiThueError);
      assert.equal(err.code, 'E-tkt-002');
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /7 khoản/);
      assert.match(err.message, /Ngừng dùng/, 'phải gợi ý lối đi thay thế');
      return true;
    },
  );
  assert.equal(daXoa, false);
});

test('Xóa danh mục chưa ai dùng thì thành công; không tìm thấy -> E-tkt-016 (404)', async () => {
  let daXoa = false;
  const db = {
    otherIncomeCategory: {
      findUnique: async () => hang({ _count: { records: 0 } }),
      delete: async () => {
        daXoa = true;
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  await deleteIncomeCategory(db, 'dm-1');
  assert.equal(daXoa, true);

  const dbRong = {
    otherIncomeCategory: { findUnique: async () => null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  await assert.rejects(
    () => deleteIncomeCategory(dbRong, 'khong-co'),
    (err: unknown) => {
      assert.ok(err instanceof ToKhaiThueError);
      assert.equal(err.code, 'E-tkt-016');
      assert.equal(err.statusCode, 404);
      return true;
    },
  );
});

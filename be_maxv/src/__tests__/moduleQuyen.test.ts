import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  goiConHieuLuc,
  moduleCuaGoi,
  type GoiRutGon,
} from '../services/shared/modules.service';

/**
 * Test luật quy đổi quyền module — hàm thuần, không đụng DB.
 *   npx tsx --test src/__tests__/moduleQuyen.test.ts
 */

const BAY_GIO = new Date('2026-08-13T00:00:00Z');
const HOM_QUA = new Date('2026-08-12T00:00:00Z');
const NGAY_MAI = new Date('2026-08-14T00:00:00Z');

function goi(
  status: GoiRutGon['status'],
  ketThuc: Date | null,
  features: unknown = { hrm: true },
): GoiRutGon {
  return { status, ketThuc, plan: { features: features as never } };
}

test('goiConHieuLuc', () => {
  assert.equal(goiConHieuLuc(null, BAY_GIO), false, 'không có gói');

  assert.equal(goiConHieuLuc(goi('ACTIVE', null), BAY_GIO), true, 'không thời hạn');
  assert.equal(goiConHieuLuc(goi('ACTIVE', NGAY_MAI), BAY_GIO), true, 'chưa tới hạn');
  assert.equal(goiConHieuLuc(goi('TRIALING', NGAY_MAI), BAY_GIO), true, 'đang dùng thử');

  // Điểm dễ sai nhất: trạng thái chưa kịp đổi nhưng ngày đã qua.
  assert.equal(
    goiConHieuLuc(goi('ACTIVE', HOM_QUA), BAY_GIO),
    false,
    'quá hạn thì không tin status',
  );

  for (const st of ['EXPIRED', 'CANCELED', 'PAST_DUE'] as const) {
    assert.equal(goiConHieuLuc(goi(st, NGAY_MAI), BAY_GIO), false, `status ${st}`);
  }
});

test('moduleCuaGoi — chỉ nhận đúng khóa và đúng giá trị true', () => {
  assert.deepEqual(moduleCuaGoi(null, BAY_GIO), { hrm: false, accounting: false }, 'không có gói');
  assert.deepEqual(
    moduleCuaGoi(goi('ACTIVE', null, {}), BAY_GIO),
    { hrm: false, accounting: false },
    'features rỗng',
  );
  assert.deepEqual(
    moduleCuaGoi(goi('ACTIVE', null, { hrm: true }), BAY_GIO),
    { hrm: true, accounting: false },
    'gói có HRM',
  );
  assert.deepEqual(
    moduleCuaGoi(goi('ACTIVE', null, { hrm: true, accounting: true }), BAY_GIO),
    { hrm: true, accounting: true },
    'gói có cả HRM lẫn Kế toán',
  );
  assert.deepEqual(
    moduleCuaGoi(goi('ACTIVE', null, { hrm: false }), BAY_GIO),
    { hrm: false, accounting: false },
    'false thì không cấp',
  );
  assert.deepEqual(
    moduleCuaGoi(goi('ACTIVE', null, { hrm: 'true' }), BAY_GIO),
    { hrm: false, accounting: false },
    'chuỗi "true" không phải true',
  );
  assert.deepEqual(
    moduleCuaGoi(goi('ACTIVE', null, { khoaLa: true }), BAY_GIO),
    { hrm: false, accounting: false },
    'khóa ngoài MODULE_KEYS bị bỏ qua',
  );

  // features là Json nên có thể là bất cứ thứ gì — không được ném lỗi.
  for (const rac of [null, [], 'chuoi', 42]) {
    assert.deepEqual(
      moduleCuaGoi(goi('ACTIVE', null, rac), BAY_GIO),
      { hrm: false, accounting: false },
      `features = ${JSON.stringify(rac)}`,
    );
  }

  assert.deepEqual(
    moduleCuaGoi(goi('ACTIVE', HOM_QUA, { hrm: true }), BAY_GIO),
    { hrm: false, accounting: false },
    'gói hết hạn thì không cấp dù features có',
  );
});


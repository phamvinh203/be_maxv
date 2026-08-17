import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertMstConfirmed } from '../services/client/company.service';
import { deleteCompanySchema } from '../validators/company.validator';
import { ConflictError } from '../helpers/errors';

/**
 * Test lớp xác nhận của luồng XÓA CỨNG công ty (DROP DATABASE tenant + xóa bản ghi): người dùng
 * phải gõ lại đúng MST. Hai tầng, test riêng từng tầng vì mỗi tầng chịu trách nhiệm khác nhau —
 * schema chuẩn hóa/chặn định dạng rác (400), `assertMstConfirmed` so với MST thật (409).
 * Phần đụng Postgres (dropTenant/delete) không test được ở đây.
 *
 *   npx tsx --test src/__tests__/companyDelete.test.ts
 */

const MST = '0106861880';
const BRANCH_MST = '0106861880-001';

// ---------------- deleteCompanySchema: chuẩn hóa + chặn định dạng rác ----------------

test('deleteCompanySchema: cắt khoảng trắng thừa đầu/cuối', () => {
  assert.equal(
    deleteCompanySchema.parse({ maSoThue: `  ${MST} ` }).maSoThue,
    MST,
  );
});

test('deleteCompanySchema: nhận MST chi nhánh 10+3 số', () => {
  assert.equal(
    deleteCompanySchema.parse({ maSoThue: BRANCH_MST }).maSoThue,
    BRANCH_MST,
  );
});

test('deleteCompanySchema: khoảng trắng GIỮA chuỗi là định dạng rác -> chặn', () => {
  assert.equal(
    deleteCompanySchema.safeParse({ maSoThue: '0106 861880' }).success,
    false,
  );
});

test('deleteCompanySchema: bỏ trống -> chặn', () => {
  assert.equal(deleteCompanySchema.safeParse({ maSoThue: '' }).success, false);
});

// ---------------- assertMstConfirmed: so với MST thật của công ty ----------------

test('assertMstConfirmed: gõ đúng MST -> đi tiếp', () => {
  assert.doesNotThrow(() => assertMstConfirmed(MST, MST));
});

test('assertMstConfirmed: gõ MST công ty KHÁC -> chặn', () => {
  assert.throws(() => assertMstConfirmed('0106097979', MST), ConflictError);
});

test('assertMstConfirmed: MST chi nhánh không tính là MST gốc -> chặn', () => {
  assert.throws(() => assertMstConfirmed(MST, BRANCH_MST), ConflictError);
});

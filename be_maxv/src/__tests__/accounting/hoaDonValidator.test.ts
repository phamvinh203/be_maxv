import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoaDonBodySchema } from '../../validators/accounting/banHang/hoaDonBanHang.validator';

/**
 * vbsec 2026-09-10 (LOW, hoaDonBanHang.validator.ts:120): `chi_tiet` không có trần, chuỗi không giới hạn
 * độ dài -> một request ghi hàng chục nghìn dòng; chuỗi dài hơn cột `VarChar` thì lỗi DB (500) thay vì 400
 * nói rõ ô nào sai.
 */

const dong = { ma_vt: 'VT01', so_luong: 1, gia_nt2: 1000 };
const hopLe = (them: Record<string, unknown> = {}) =>
  hoaDonBodySchema.safeParse({ so_ct: '0001', ma_kh: 'KH01', chi_tiet: [dong], ...them });

test('tối đa 500 dòng chi tiết mỗi hóa đơn', () => {
  assert.equal(hopLe({ chi_tiet: Array(500).fill(dong) }).success, true);
  assert.equal(hopLe({ chi_tiet: Array(501).fill(dong) }).success, false);
});

test('chuỗi dài hơn cột VarChar -> 400 (không để DB báo lỗi 500)', () => {
  assert.equal(hopLe({ so_ct: 'x'.repeat(25) }).success, false); // VarChar(24)
  assert.equal(hopLe({ dien_giai: 'x'.repeat(513) }).success, false); // VarChar(512)
  assert.equal(hopLe({ ong_ba: 'x'.repeat(255) }).success, false); // VarChar(254)
  assert.equal(hopLe({ chi_tiet: [{ ...dong, ma_vt: 'x'.repeat(33) }] }).success, false); // VarChar(32)
  assert.equal(hopLe({ chi_tiet: [{ ...dong, ma_kho: 'x'.repeat(25) }] }).success, false);
  assert.equal(hopLe({ dien_giai: 'x'.repeat(512) }).success, true);
});

test('số không hữu hạn (Infinity) bị chặn', () => {
  assert.equal(hopLe({ chi_tiet: [{ ...dong, so_luong: 'Infinity' }] }).success, false);
});

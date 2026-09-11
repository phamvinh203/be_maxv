import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordRule } from '../validators/auth.validator';
import {
  lyDoKhongPhaiDbKiemThu,
  matKhauNgauNhien,
} from './_hoTro/dbKiemThu';

/**
 * vbsec 2026-09-10 (LOW, adminOwner.test.ts:14 + hrmSettingsShiftsHolidaysApi.test.ts:32): test chạm DB
 * thật tạo tài khoản ADMIN/OWNER mật khẩu cứng (`Test1234`, `QaHrm1234`) vào DB ĐANG CẤU HÌNH, không kiểm
 * đó có phải DB test. Trỏ nhầm `.env` sang DB thật mà test bị ngắt giữa chừng là để lại tài khoản quản
 * trị với mật khẩu ai đọc repo cũng biết.
 */

const local = 'postgresql://u:p@localhost:5432/maxv2_sys';

test('DB local, không phải production -> được chạy', () => {
  assert.equal(lyDoKhongPhaiDbKiemThu('development', [local]), null);
  assert.equal(lyDoKhongPhaiDbKiemThu('test', ['postgresql://u:p@127.0.0.1:5432/x']), null);
});

test('NODE_ENV=production -> chặn', () => {
  assert.ok(lyDoKhongPhaiDbKiemThu('production', [local]));
});

test('DB ở máy khác -> chặn, trừ khi bật cờ cho phép tường minh', () => {
  const xa = 'postgresql://u:p@10.0.0.5:5432/maxv2_sys';
  assert.ok(lyDoKhongPhaiDbKiemThu('development', [local, xa]));
  assert.equal(lyDoKhongPhaiDbKiemThu('development', [xa], true), null);
});

test('lý do chặn không lộ mật khẩu DB', () => {
  const lyDo = lyDoKhongPhaiDbKiemThu('development', ['postgresql://u:BiMat123@db.congty.vn:5432/x']);
  assert.ok(lyDo && !lyDo.includes('BiMat123'), String(lyDo));
});

test('mật khẩu test sinh ngẫu nhiên, mỗi lần một khác, qua được luật mật khẩu', () => {
  const a = matKhauNgauNhien();
  const b = matKhauNgauNhien();
  assert.notEqual(a, b);
  assert.equal(passwordRule.safeParse(a).success, true);
});

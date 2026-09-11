import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docRoleQuanTri } from '../../config/env';
import { cauTaoDatabase } from '../../services/shared/provisioning.service';

/**
 * vbsec 2026-09-10 (LOW, env.ts:58): MỘT role Postgres vừa CREATE/DROP DATABASE vừa phục vụ mọi tenant và
 * control plane — lộ thông tin kết nối của app là có luôn quyền tạo/xóa DB. Hỗ trợ tách role (tùy chọn):
 * `DB_ADMIN_USER`/`DB_ADMIN_PASSWORD` chỉ dùng cho provisioning; DB tenant mới giao cho role app làm OWNER
 * để app vẫn đẩy schema được mà không cần quyền CREATEDB.
 */

test('không đặt DB_ADMIN_USER -> dùng chung role app như trước (không đổi hành vi)', () => {
  assert.deepEqual(docRoleQuanTri({}, 'app', 'mk-app'), {
    user: 'app',
    password: 'mk-app',
    tachRieng: false,
  });
});

test('đặt DB_ADMIN_USER + DB_ADMIN_PASSWORD -> role quản trị riêng', () => {
  assert.deepEqual(
    docRoleQuanTri({ DB_ADMIN_USER: 'maxv_provision', DB_ADMIN_PASSWORD: 'mk-qt' }, 'app', 'mk-app'),
    { user: 'maxv_provision', password: 'mk-qt', tachRieng: true },
  );
});

test('đặt DB_ADMIN_USER mà thiếu mật khẩu -> báo lỗi cấu hình, không lặng lẽ dùng mật khẩu app', () => {
  assert.throws(() => docRoleQuanTri({ DB_ADMIN_USER: 'maxv_provision' }, 'app', 'mk-app'), /DB_ADMIN_PASSWORD/);
});

test('tách role -> CREATE DATABASE giao OWNER cho role app; không tách -> như cũ', () => {
  assert.equal(cauTaoDatabase('maxv_0101243150_app'), 'CREATE DATABASE "maxv_0101243150_app"');
  assert.equal(
    cauTaoDatabase('maxv_0101243150_app', 'maxv_app'),
    'CREATE DATABASE "maxv_0101243150_app" OWNER "maxv_app"',
  );
  assert.throws(() => cauTaoDatabase('maxv_0101243150_app', 'app"; DROP DATABASE x; --'), /không hợp lệ/);
});

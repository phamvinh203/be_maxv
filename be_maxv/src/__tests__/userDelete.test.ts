import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertEmailConfirmed } from '../services/admin/adminUser.service';
import { deleteUserSchema } from '../validators/admin.validator';
import { ConflictError } from '../helpers/errors';
import { MESSAGES } from '../constants/messages';

/**
 * Test lớp xác nhận của luồng XÓA CỨNG tài khoản (DROP DATABASE mọi MST của owner + xóa
 * bản ghi user): admin phải gõ lại đúng email. Hai tầng, test riêng từng tầng vì mỗi tầng
 * chịu trách nhiệm khác nhau — schema chuẩn hóa/chặn định dạng rác (400),
 * `assertEmailConfirmed` so với email thật (409).
 * Phần đụng Postgres (dropTenant/delete) không test được ở đây.
 *
 *   npx tsx --test src/__tests__/userDelete.test.ts
 */

const EMAIL = 'vinh@gmail.com';

// ---------------- deleteUserSchema: chuẩn hóa + chặn định dạng rác ----------------

test('deleteUserSchema: cắt khoảng trắng thừa đầu/cuối', () => {
  assert.equal(deleteUserSchema.parse({ email: `  ${EMAIL} ` }).email, EMAIL);
});

test('deleteUserSchema: hạ chữ hoa về chữ thường', () => {
  assert.equal(deleteUserSchema.parse({ email: 'Vinh@Gmail.COM' }).email, EMAIL);
});

test('deleteUserSchema: chuỗi không phải email -> chặn', () => {
  assert.equal(deleteUserSchema.safeParse({ email: 'vinh' }).success, false);
});

test('deleteUserSchema: bỏ trống -> chặn', () => {
  assert.equal(deleteUserSchema.safeParse({ email: '' }).success, false);
});

// ---------------- assertEmailConfirmed: so với email thật của user ----------------

test('assertEmailConfirmed: gõ đúng email -> đi tiếp', () => {
  assert.doesNotThrow(() => assertEmailConfirmed(EMAIL, EMAIL));
});

test('assertEmailConfirmed: gõ email tài khoản KHÁC -> chặn', () => {
  assert.throws(
    () => assertEmailConfirmed('test7@gmail.com', EMAIL),
    ConflictError,
  );
});

test('assertEmailConfirmed: gõ thiếu 1 ký tự -> chặn', () => {
  assert.throws(() => assertEmailConfirmed('vinh@gmail.co', EMAIL), {
    message: MESSAGES.USER.EMAIL_MISMATCH,
  });
});

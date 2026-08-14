import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPlanDeletable } from '../services/admin/adminSubscription.service';
import { ConflictError } from '../helpers/errors';
import { MESSAGES } from '../constants/messages';

/**
 * Test lớp guard của luồng XÓA CỨNG gói dịch vụ. FK subscription/history -> plan là
 * Restrict, nên gói còn tham chiếu sẽ bị Postgres chặn; guard này chặn sớm để trả 409
 * kèm hướng dẫn "chuyển sang Ngừng bán" thay vì lỗi thô.
 * Phần đụng Postgres (findUnique/delete/P2003) không test được ở đây.
 *
 *   npx tsx --test src/__tests__/planDelete.test.ts
 */

test('assertPlanDeletable: gói chưa từng dùng -> cho xóa', () => {
  assert.doesNotThrow(() =>
    assertPlanDeletable({ subscriptions: 0, histories: 0 }),
  );
});

test('assertPlanDeletable: còn thuê bao hiện hành -> chặn', () => {
  assert.throws(
    () => assertPlanDeletable({ subscriptions: 1, histories: 0 }),
    ConflictError,
  );
});

test('assertPlanDeletable: hết thuê bao nhưng còn lịch sử -> vẫn chặn', () => {
  assert.throws(
    () => assertPlanDeletable({ subscriptions: 0, histories: 3 }),
    ConflictError,
  );
});

test('assertPlanDeletable: thông báo chỉ đúng hướng xử lý thay thế', () => {
  assert.throws(() => assertPlanDeletable({ subscriptions: 2, histories: 5 }), {
    message: MESSAGES.SUBSCRIPTION.PLAN_IN_USE,
  });
});

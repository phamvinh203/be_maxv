import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cauHinhSmtp } from '../services/shared/mailer.service';

/**
 * vbsec 2026-09-10 (LOW, mailer.service.ts:10): cổng 587 dùng STARTTLS nhưng không `requireTLS` —
 * nodemailer thấy máy chủ (hoặc kẻ đứng giữa gỡ lệnh STARTTLS) không chào TLS thì gửi TRẦN: mật khẩu
 * SMTP (AUTH) và nội dung mail (mật khẩu tạm, lời mời) đi dạng rõ. Sửa: bắt buộc nâng TLS.
 */
const TK = { host: 'smtp.gmail.com', user: 'noreply@example.com', pass: 'x' };

test('cổng STARTTLS (587): bắt buộc nâng TLS, không cho gửi trần', () => {
  const c = cauHinhSmtp({ ...TK, port: 587 });
  assert.equal(c.secure, false);
  assert.equal(c.requireTLS, true);
});

test('cổng TLS ngầm (465): secure ngay từ đầu', () => {
  const c = cauHinhSmtp({ ...TK, port: 465 });
  assert.equal(c.secure, true);
});

test('giữ timeout tường minh (không treo request 2 phút khi cổng SMTP bị chặn)', () => {
  const c = cauHinhSmtp({ ...TK, port: 587 });
  assert.equal(c.connectionTimeout, 10_000);
  assert.equal(c.greetingTimeout, 10_000);
  assert.equal(c.socketTimeout, 20_000);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { parseTrustProxy } from '../config/env';

/**
 * `TRUST_PROXY` -> `trustProxy` của Fastify quyết định `req.ip` — khóa của MỌI rate limit
 * (`@fastify/rate-limit` mặc định keyGenerator = req.ip, gồm STRICT_AUTH_LIMIT 5/phút cho login)
 * và IP ghi vào nhật ký kiểm toán (requestContext -> syslog).
 *
 * Lỗ hổng vbsec 2026-09-10 [6]: `TRUST_PROXY=true` từng thành `trustProxy: true` = tin MỌI hop, nên
 * `req.ip` là phần tử TRÁI NHẤT của `X-Forwarded-For` — do client tự đặt. Mỗi request đổi header là
 * một "xô" rate limit mới -> đoán mật khẩu không giới hạn.
 *
 * Kiểm bằng Fastify thật + `inject` (đặt được địa chỉ kết nối `remoteAddress`), chỉ route trả `req.ip`.
 */

async function ipNhanDuoc(
  trustProxyEnv: string | undefined,
  remoteAddress: string,
  xForwardedFor?: string,
): Promise<string> {
  const app = Fastify({ trustProxy: parseTrustProxy(trustProxyEnv) });
  app.get('/ip', async (req) => ({ ip: req.ip }));
  const res = await app.inject({
    method: 'GET',
    url: '/ip',
    remoteAddress,
    headers: xForwardedFor ? { 'x-forwarded-for': xForwardedFor } : {},
  });
  await app.close();
  return res.json().ip;
}

test('TRUST_PROXY=true: request đi qua proxy cùng máy — IP giả client tự chèn bên trái X-Forwarded-For bị bỏ qua', async () => {
  // nginx `$proxy_add_x_forwarded_for` NỐI IP thật vào cuối header client gửi lên.
  assert.equal(
    await ipNhanDuoc('true', '127.0.0.1', '1.2.3.4, 198.51.100.7'),
    '198.51.100.7',
  );
  assert.equal(
    await ipNhanDuoc('true', '::1', '1.2.3.4, 198.51.100.7'),
    '198.51.100.7',
  );
});

test('TRUST_PROXY=true: kết nối THẲNG từ Internet (không qua proxy) không giả được IP bằng header', async () => {
  assert.equal(
    await ipNhanDuoc('true', '203.0.113.9', '1.2.3.4'),
    '203.0.113.9',
  );
});

test('TRUST_PROXY=true: proxy nằm trong mạng nội bộ (LAN) vẫn được tin', async () => {
  assert.equal(
    await ipNhanDuoc('true', '10.0.0.5', '198.51.100.7'),
    '198.51.100.7',
  );
  assert.equal(
    await ipNhanDuoc('true', '192.168.1.20', '198.51.100.7'),
    '198.51.100.7',
  );
});

test('TRUST_PROXY là địa chỉ proxy cụ thể: chỉ tin đúng proxy đó', async () => {
  assert.equal(
    await ipNhanDuoc('10.1.2.3', '10.1.2.3', '1.2.3.4, 198.51.100.7'),
    '198.51.100.7',
  );
  assert.equal(
    await ipNhanDuoc('10.1.2.3', '10.9.9.9', '198.51.100.7'),
    '10.9.9.9',
  );
});

test('TRUST_PROXY là số hop: chỉ tin đúng số proxy đứng trước app', async () => {
  assert.equal(
    await ipNhanDuoc('1', '127.0.0.1', '1.2.3.4, 198.51.100.7'),
    '198.51.100.7',
  );
});

test('Không đặt TRUST_PROXY: bỏ qua hoàn toàn X-Forwarded-For', async () => {
  assert.equal(
    await ipNhanDuoc(undefined, '203.0.113.9', '1.2.3.4'),
    '203.0.113.9',
  );
  assert.equal(
    await ipNhanDuoc('false', '203.0.113.9', '1.2.3.4'),
    '203.0.113.9',
  );
});

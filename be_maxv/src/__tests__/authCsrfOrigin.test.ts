import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';

/**
 * vbsec 2026-09-10 (LOW, auth.route.ts:22): `/auth/logout` và `/auth/refresh` đổi trạng thái chỉ dựa vào
 * cookie, không kiểm nguồn gọi. Trang lạ gửi form POST tới `/auth/logout` là người dùng bị đăng xuất (cookie
 * bị xóa trong response điều hướng top-level); `/auth/refresh` bị gọi chéo site để xoay phiên ngoài ý muốn.
 * Sửa: chặn khi `Origin` không phải FE đã cấu hình (whitelist CORS) và cũng không cùng origin với API.
 *
 * Route THẬT; controller thay bằng bản rỗng (thứ đang kiểm là guard của route).
 */

let authRoutes: (app: FastifyInstance) => Promise<void>;
let FE: string;

before(async () => {
  const ok = async () => ({ ok: true });
  mock.module('../controllers/client/auth.controller', {
    namedExports: {
      register: ok,
      login: ok,
      me: ok,
      refresh: ok,
      logout: ok,
      forgotPassword: ok,
      resetPassword: ok,
    },
  });
  ({ authRoutes } = await import('../routes/auth.route'));
  FE = (await import('../config/env')).env.allowedOrigins[0]!;
});

async function taoApp() {
  const { default: errorHandlerPlugin } =
    await import('../plugins/errorHandler.plugin');
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  app.decorate('authenticate', async () => {});
  await app.register(authRoutes);
  await app.ready();
  return app;
}

test('trang lạ gọi chéo site (Origin lạ / "null") -> 403 cho cả logout lẫn refresh', async () => {
  const app = await taoApp();
  for (const url of ['/logout', '/refresh']) {
    for (const headers of [
      { origin: 'https://trang-la.example', 'sec-fetch-site': 'cross-site' },
      { origin: 'https://trang-la.example' },
      { origin: 'null' },
    ]) {
      const res = await app.inject({ method: 'POST', url, headers });
      assert.equal(res.statusCode, 403, `${url} ${JSON.stringify(headers)}`);
    }
  }
  await app.close();
});

test('FE đã cấu hình / cùng origin với API / không có Origin (không phải trình duyệt) -> cho qua', async () => {
  const app = await taoApp();
  for (const url of ['/logout', '/refresh']) {
    for (const headers of [
      { origin: FE },
      { origin: 'https://app.maxv.example', 'sec-fetch-site': 'same-origin' },
      { origin: 'http://api.maxv.example', host: 'api.maxv.example' },
      {},
    ]) {
      const res = await app.inject({ method: 'POST', url, headers });
      assert.equal(res.statusCode, 200, `${url} ${JSON.stringify(headers)}`);
    }
  }
  await app.close();
});

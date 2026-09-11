import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import errorHandlerPlugin from '../plugins/errorHandler.plugin';
import { UnauthorizedError } from '../helpers/errors';
import {
  STRICT_AUTH_LIMIT,
  gioiHanTheoNguoiDung,
} from '../constants/rateLimits';

/**
 * Rate limit (constants/rateLimits.ts) chạy trên Fastify + @fastify/rate-limit THẬT, cấu hình như
 * app.ts (giới hạn toàn app + errorHandler của dự án).
 *
 * vbsec 2026-09-10:
 *  - Các route tốn tài nguyên (tạo/xóa công ty = CREATE/DROP DATABASE, mời nhân viên = gửi mail cho mọi
 *    admin, captcha cổng thuế...) chỉ có giới hạn chung theo IP. Cần giới hạn theo NGƯỜI DÙNG, chạy SAU
 *    bước xác thực.
 *  - Vượt giới hạn phải trả 429 — errorHandler từng biến lỗi 429 của plugin thành 500 "Lỗi máy chủ".
 */

async function taoApp() {
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  // Giả `app.authenticate`: user lấy từ header `x-user` (không có -> 401), như jwt.plugin.
  app.decorate('authenticate', async (req: FastifyRequest) => {
    const userId = req.headers['x-user'];
    if (typeof userId !== 'string') throw new UnauthorizedError('Chưa đăng nhập');
    req.user = { userId, donViId: null, role: 'OWNER', tokenVersion: 0 };
  });
  app.post('/dang-nhap', STRICT_AUTH_LIMIT, async () => ({ ok: true }));
  app.post(
    '/tao-cong-ty',
    { preHandler: [app.authenticate], ...gioiHanTheoNguoiDung(2, '1 minute') },
    async () => ({ ok: true }),
  );
  await app.ready();
  return app;
}

test('vượt giới hạn -> 429 (không phải 500 "lỗi máy chủ")', async () => {
  const app = await taoApp();
  const ma: number[] = [];
  for (let i = 0; i < 6; i++) {
    ma.push((await app.inject({ method: 'POST', url: '/dang-nhap' })).statusCode);
  }
  assert.deepEqual(ma, [200, 200, 200, 200, 200, 429]);
  await app.close();
});

test('giới hạn theo người dùng: đếm theo userId, người khác không bị vạ lây, đổi IP không lách được', async () => {
  const app = await taoApp();
  const goi = (user: string, ip: string) =>
    app.inject({ method: 'POST', url: '/tao-cong-ty', headers: { 'x-user': user }, remoteAddress: ip });

  assert.equal((await goi('owner-a', '203.0.113.1')).statusCode, 200);
  assert.equal((await goi('owner-a', '203.0.113.2')).statusCode, 200);
  assert.equal((await goi('owner-a', '203.0.113.3')).statusCode, 429, 'đổi IP vẫn bị chặn');

  assert.equal((await goi('owner-b', '203.0.113.3')).statusCode, 200, 'người dùng khác vẫn dùng được');
  await app.close();
});

test('giới hạn theo người dùng chạy SAU xác thực: chưa đăng nhập vẫn là 401', async () => {
  const app = await taoApp();
  const res = await app.inject({ method: 'POST', url: '/tao-cong-ty' });
  assert.equal(res.statusCode, 401);
  await app.close();
});

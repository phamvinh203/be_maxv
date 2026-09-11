import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import errorHandlerPlugin from '../plugins/errorHandler.plugin';

/**
 * Giới hạn theo người dùng trên các route công ty tốn tài nguyên (routes/company.route.ts).
 *
 * vbsec 2026-09-10 (MEDIUM):
 *  - company.route.ts:16 — `POST /companies` (CREATE DATABASE + `prisma db push`) và
 *    `DELETE /companies/:id` (DROP DATABASE) chỉ có giới hạn chung 300/phút/IP: owner dùng thử lặp
 *    tạo-xóa là vắt kiệt Postgres dùng chung.
 *  - company.route.ts:46 — `POST /companies/invite` gửi mail cho MỌI admin mỗi lần gọi: dội 300/phút
 *    là cạn hạn mức SMTP dùng chung (OTP đặt lại mật khẩu ngừng gửi cho mọi người).
 *
 * Route THẬT; controller thay bằng handler rỗng (thứ đang kiểm là cấu hình route, không phải nghiệp vụ).
 */

let companyRoutes: (app: FastifyInstance) => Promise<void>;

before(async () => {
  const ok = async () => ({ ok: true });
  mock.module('../controllers/client/company.controller', {
    namedExports: {
      createCompany: ok,
      deleteCompany: ok,
      listCompanies: ok,
      switchCompany: ok,
      updateCompany: ok,
      inviteUser: ok,
      listEmployees: ok,
      listInvites: ok,
      setAccess: ok,
    },
  });
  ({ companyRoutes } = await import('../routes/company.route'));
});

async function taoApp() {
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  app.decorate('authenticate', async (req: FastifyRequest) => {
    req.user = {
      userId: String(req.headers['x-user']),
      donViId: null,
      role: 'OWNER',
      tokenVersion: 0,
    };
  });
  app.decorate('requireRole', () => async () => {});
  await app.register(companyRoutes);
  await app.ready();
  return app;
}

async function maTraVe(app: FastifyInstance, method: 'POST' | 'DELETE', url: string, user: string, soLan: number) {
  const ma: number[] = [];
  for (let i = 0; i < soLan; i++) {
    ma.push((await app.inject({ method, url, headers: { 'x-user': user } })).statusCode);
  }
  return ma;
}

test('POST /companies: tối đa 5 lượt / 10 phút / owner', async () => {
  const app = await taoApp();
  assert.deepEqual(await maTraVe(app, 'POST', '/', 'owner-a', 6), [200, 200, 200, 200, 200, 429]);
  assert.deepEqual(await maTraVe(app, 'POST', '/', 'owner-b', 1), [200], 'owner khác không bị ảnh hưởng');
  await app.close();
});

test('DELETE /companies/:id: tối đa 5 lượt / 10 phút / owner', async () => {
  const app = await taoApp();
  assert.deepEqual(await maTraVe(app, 'DELETE', '/cty-1', 'owner-a', 6), [200, 200, 200, 200, 200, 429]);
  await app.close();
});

test('POST /companies/invite: tối đa 20 lời mời / giờ / owner', async () => {
  const app = await taoApp();
  const ma = await maTraVe(app, 'POST', '/invite', 'owner-a', 21);
  assert.deepEqual(ma.slice(0, 20), Array(20).fill(200));
  assert.equal(ma[20], 429);
  await app.close();
});

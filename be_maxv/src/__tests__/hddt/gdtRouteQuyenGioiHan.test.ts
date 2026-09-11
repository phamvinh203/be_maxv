import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import errorHandlerPlugin from '../../plugins/errorHandler.plugin';

/**
 * vbsec 2026-09-10 (LOW):
 *  - gdt.route.ts:213 — nhóm HĐĐT không có guard vai trò -> MỌI nhân viên gọi được `DELETE /gdt/sync/data`
 *    xóa sạch hóa đơn đã lưu của công ty.
 *  - gdt.route.ts:47 — `POST /gdt/login` chuyển tiếp MST + mật khẩu + captcha tới cổng thuế, chỉ có giới
 *    hạn chung 300/phút -> dùng server làm proxy đoán mật khẩu cổng HĐĐT.
 *
 * Route + controller THẬT; dịch vụ gọi cổng / DB thay bằng bản giả.
 */

let soLanXoa = 0;
let gdtRoutes: (fastify: FastifyInstance) => Promise<void>;

before(async () => {
  mock.module('../../services/client/hddt/gdt.service', {
    namedExports: {
      clearSyncedData: async () => {
        soLanXoa += 1;
        return { ok: true };
      },
      login: async () => ({ token: 't' }),
    },
  });
  mock.module('../../helpers/resolveTenantDb', {
    namedExports: {
      resolveTenantDb: async () => ({}),
      resolveTenantDbName: async () => 'db',
      resolveTenantInfo: async () => ({ dbName: 'db', maSoThue: '0100000000', xemLuong: true }),
    },
  });
  mock.module('../../config/db.sys', {
    namedExports: { sysPrisma: { donVi: { findFirst: async () => null, update: async () => ({}) } } },
  });
  ({ default: gdtRoutes } = await import('../../routes/hddt/gdt.route'));
});

async function taoApp() {
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  app.decorate('authenticate', async (req: FastifyRequest) => {
    req.user = {
      userId: String(req.headers['x-user'] ?? 'u'),
      donViId: 'dv-1',
      role: String(req.headers['x-role'] ?? 'OWNER'),
      tokenVersion: 0,
    };
  });
  await app.register(gdtRoutes);
  await app.ready();
  return app;
}

test('DELETE /sync/data: nhân viên bị chặn 403, không xóa gì; chủ tài khoản xóa được', async () => {
  const app = await taoApp();
  soLanXoa = 0;

  const nv = await app.inject({ method: 'DELETE', url: '/sync/data', headers: { 'x-role': 'OWNER_EMPLOYEE' } });
  assert.equal(nv.statusCode, 403);
  assert.equal(soLanXoa, 0);

  const owner = await app.inject({ method: 'DELETE', url: '/sync/data', headers: { 'x-role': 'OWNER' } });
  assert.equal(owner.statusCode, 200);
  assert.equal(soLanXoa, 1);
  await app.close();
});

test('POST /login: tối đa 10 lượt / 10 phút / người dùng', async () => {
  const app = await taoApp();
  const ma: number[] = [];
  for (let i = 0; i < 11; i++) {
    const res = await app.inject({
      method: 'POST',
      url: '/login',
      headers: { 'x-user': 'user-a' },
      payload: { mst: '0100000000', password: 'x', captcha: 'c', key: 'k' },
    });
    ma.push(res.statusCode);
  }
  assert.deepEqual(ma, [...Array(10).fill(200), 429]);
  await app.close();
});

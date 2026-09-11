import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import errorHandlerPlugin from '../../plugins/errorHandler.plugin';
import { UnauthorizedError } from '../../helpers/errors';
import { Prisma } from '../../generated/tenant';

/**
 * Route HĐĐT (routes/hddt/gdt.route.ts) — route + controller THẬT.
 *
 * vbsec 2026-09-10 (MEDIUM):
 *  - gdt.route.ts:44 — `GET /gdt/captcha` KHÔNG cần đăng nhập, mỗi lượt gọi mở kết nối tới cổng
 *    hoadondientu: người lạ dùng server MAXV làm proxy dội cổng thuế -> GDT chặn IP chung của mọi khách.
 *  - gdt.controller.ts:249 — lỗi nội bộ (Prisma: đường dẫn file, đoạn code, tên bảng) trả thẳng ra client.
 *
 * Thay `gdt.service` bằng bản giả (test KHÔNG được gọi mạng ra cổng thuế) và `resolveTenantDb`.
 */

let loiDocHoaDon: unknown = null;

let gdtRoutes: (fastify: FastifyInstance) => Promise<void>;

before(async () => {
  mock.module('../../services/client/hddt/gdt.service', {
    namedExports: {
      getCaptcha: async () => ({ key: 'k', content: '<svg/>' }),
      getSavedInvoices: async () => {
        throw loiDocHoaDon;
      },
    },
  });
  mock.module('../../helpers/resolveTenantDb', {
    namedExports: {
      resolveTenantDb: async () => ({}),
      resolveTenantDbName: async () => 'test-db',
      resolveTenantInfo: async () => ({ dbName: 'test-db', maSoThue: '0000000000', xemLuong: true }),
      resolveTenantCtx: async () => ({ db: {}, dbName: 'test-db', maSoThue: '0000000000', xemLuong: true }),
      assertXemLuong: () => {},
      currentUserId: () => 'user-1',
    },
  });
  ({ default: gdtRoutes } = await import('../../routes/hddt/gdt.route'));
});

async function taoApp() {
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  app.decorate('authenticate', async (req: FastifyRequest) => {
    const userId = req.headers['x-user'];
    if (typeof userId !== 'string') throw new UnauthorizedError('Chưa đăng nhập');
    req.user = { userId, donViId: 'dv-1', role: 'OWNER', tokenVersion: 0 };
  });
  await app.register(gdtRoutes);
  await app.ready();
  return app;
}

test('GET /captcha: chưa đăng nhập -> 401 (không mở kết nối ra cổng thuế cho người lạ)', async () => {
  const app = await taoApp();
  const res = await app.inject({ method: 'GET', url: '/captcha' });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('GET /captcha: tối đa 20 lượt / phút / người dùng', async () => {
  const app = await taoApp();
  const ma: number[] = [];
  for (let i = 0; i < 21; i++) {
    ma.push((await app.inject({ method: 'GET', url: '/captcha', headers: { 'x-user': 'user-1' } })).statusCode);
  }
  assert.deepEqual(ma.slice(0, 20), Array(20).fill(200));
  assert.equal(ma[20], 429);
  await app.close();
});

test('lỗi Prisma khi đọc hóa đơn đã lưu -> 500 với thông điệp chung, không lộ đường dẫn/đoạn code', async () => {
  loiDocHoaDon = new Prisma.PrismaClientValidationError(
    'Invalid `prisma.vct60view.findMany()` invocation in\nC:\\Users\\Admin\\be_maxv\\src\\services\\client\\hddt\\gdt.service.ts:1144:36',
    { clientVersion: '7.8.0' },
  );
  const app = await taoApp();
  const res = await app.inject({
    method: 'GET',
    url: '/invoices/purchase/saved?tuNgay=2026-01-01&denNgay=2026-01-31',
    headers: { 'x-user': 'user-1' },
  });
  assert.equal(res.statusCode, 500);
  assert.equal(res.json().message, 'Không đọc được hóa đơn đã lưu');
  await app.close();
});

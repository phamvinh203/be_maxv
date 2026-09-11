import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';

/**
 * vbsec 2026-09-10 (LOW, jwt.plugin.ts:49):
 *  - `requireRole` tin `role` trong access token tới hết hạn: admin vừa bị hạ quyền / khóa / đặt lại mật
 *    khẩu (tăng tokenVersion) vẫn gọi được `/admin/*` bằng vé cũ.
 *  - `ACCESS_TOKEN_TTL` không có trần: cấu hình nhầm "30d" là vé (và mọi quyết định dựa trên nó) sống 30
 *    ngày mà không thu hồi được.
 * Sửa: `requireRole` nạp lại người dùng từ DB (còn hoạt động, đúng vai trò, đúng tokenVersion); TTL access
 * token tối đa 60 phút.
 *
 * Plugin JWT THẬT; DB control plane thay bằng kho user trong bộ nhớ.
 */

type UserGia = {
  id: string;
  role: string;
  isActive: boolean;
  tokenVersion: number;
};
const khoUser = new Map<string, UserGia>();

let jwtPlugin: (app: FastifyInstance) => Promise<void>;
let ACCESS_COOKIE: string;
let docAccessTtlGiay: (raw: string | undefined) => number;

before(async () => {
  mock.module('../config/db.sys', {
    namedExports: {
      sysPrisma: {
        user: {
          findUnique: async ({ where }: { where: { id: string } }) => {
            const u = khoUser.get(where.id);
            return u ? { ...u } : null;
          },
        },
      },
    },
  });
  ({ default: jwtPlugin } = (await import('../plugins/jwt.plugin')) as never);
  ({ ACCESS_COOKIE } = await import('../constants/auth'));
  ({ docAccessTtlGiay } = await import('../config/env'));
});

beforeEach(() => {
  khoUser.clear();
  khoUser.set('admin-1', {
    id: 'admin-1',
    role: 'ADMIN',
    isActive: true,
    tokenVersion: 0,
  });
});

async function taoApp() {
  const { default: errorHandlerPlugin } =
    await import('../plugins/errorHandler.plugin');
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  await app.register(cookie);
  await app.register(jwtPlugin);
  app.get(
    '/admin/x',
    { preHandler: [app.authenticate, app.requireRole('ADMIN')] },
    async () => ({ ok: true }),
  );
  await app.ready();
  return app;
}

async function goi(app: FastifyInstance) {
  const token = app.jwt.sign({
    userId: 'admin-1',
    role: 'ADMIN',
    donViId: null,
    tokenVersion: 0,
  } as never);
  return app.inject({
    url: '/admin/x',
    headers: { cookie: `${ACCESS_COOKIE}=${token}` },
  });
}

test('admin còn nguyên -> vào được', async () => {
  const app = await taoApp();
  assert.equal((await goi(app)).statusCode, 200);
  await app.close();
});

test('vé ADMIN còn hạn nhưng DB đã hạ quyền / khóa / thu hồi phiên -> bị chặn', async () => {
  const app = await taoApp();
  for (const doi of [
    { role: 'OWNER' },
    { isActive: false },
    { tokenVersion: 1 },
  ]) {
    khoUser.set('admin-1', {
      id: 'admin-1',
      role: 'ADMIN',
      isActive: true,
      tokenVersion: 0,
      ...doi,
    });
    const res = await goi(app);
    assert.ok(
      res.statusCode === 401 || res.statusCode === 403,
      `${JSON.stringify(doi)} -> ${res.statusCode}`,
    );
  }
  khoUser.delete('admin-1');
  assert.ok([401, 403].includes((await goi(app)).statusCode), 'user đã xóa');
  await app.close();
});

test('ACCESS_TOKEN_TTL: đọc được s/m/h/giây trần, tối đa 60 phút, sai định dạng -> 15 phút', () => {
  assert.equal(docAccessTtlGiay(undefined), 900);
  assert.equal(docAccessTtlGiay('15m'), 900);
  assert.equal(docAccessTtlGiay('300'), 300);
  assert.equal(docAccessTtlGiay('45s'), 45);
  assert.equal(docAccessTtlGiay('1h'), 3600);
  assert.equal(docAccessTtlGiay('2h'), 3600);
  assert.equal(docAccessTtlGiay('30d'), 3600);
  assert.equal(docAccessTtlGiay('abc'), 900);
  assert.equal(docAccessTtlGiay('0'), 900);
});

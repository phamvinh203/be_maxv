import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';

/**
 * vbsec 2026-09-10 (LOW, payrollPeriods.route.ts:25): `POST /payroll-periods/:id/mark-paid` (APPROVED ->
 * PAID) và `/archive` (PAID -> ARCHIVED) chỉ có guard chung `requireModule('hrm')` — mọi nhân viên vào
 * được module HRM đều đánh dấu "đã chi lương" / lưu trữ kỳ được, trong khi khóa sổ / mở lại / phê duyệt
 * đã chỉ dành cho ADMIN/OWNER. Quyết định 2026-09-11 (chủ dự án): cả hai cũng chỉ ADMIN/OWNER.
 *
 * Route THẬT; controller thay bằng bản rỗng (thứ đang kiểm là guard của route).
 */

const daGoi: string[] = [];
let routes: (app: FastifyInstance) => Promise<void>;

before(async () => {
  const ghi = (ten: string) => async () => {
    daGoi.push(ten);
    return { ok: true };
  };
  mock.module(
    '../../controllers/client/hrm/du_lieu_tinh_luong/payrollPeriods.controller',
    {
      namedExports: Object.fromEntries(
        [
          'list',
          'create',
          'detail',
          'update',
          'remove',
          'submit',
          'reject',
          'lock',
          'reopen',
          'approve',
          'markPaid',
          'archive',
        ].map((t) => [t, ghi(t)]),
      ),
    },
  );
  ({ hrmPayrollPeriodsRoutes: routes } =
    await import('../../routes/hrm/du_lieu_tinh_luong/payrollPeriods.route'));
});

beforeEach(() => {
  daGoi.length = 0;
});

async function taoApp() {
  const { default: errorHandlerPlugin } =
    await import('../../plugins/errorHandler.plugin');
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  app.addHook('onRequest', async (req: FastifyRequest) => {
    req.user = {
      userId: 'u',
      donViId: 'dv-1',
      role: String(req.headers['x-role']),
      tokenVersion: 0,
    };
  });
  await app.register(routes);
  await app.ready();
  return app;
}

test('nhân viên (OWNER_EMPLOYEE) không đánh dấu đã chi / lưu trữ kỳ lương được -> 403, không chạm service', async () => {
  const app = await taoApp();
  for (const url of [
    '/payroll-periods/p1/mark-paid',
    '/payroll-periods/p1/archive',
  ]) {
    const res = await app.inject({
      method: 'POST',
      url,
      headers: { 'x-role': 'OWNER_EMPLOYEE' },
    });
    assert.equal(res.statusCode, 403, url);
  }
  assert.deepEqual(daGoi, []);
  await app.close();
});

test('chủ tài khoản / quản trị làm được', async () => {
  const app = await taoApp();
  for (const role of ['OWNER', 'ADMIN']) {
    for (const url of [
      '/payroll-periods/p1/mark-paid',
      '/payroll-periods/p1/archive',
    ]) {
      const res = await app.inject({
        method: 'POST',
        url,
        headers: { 'x-role': role },
      });
      assert.equal(res.statusCode, 200, `${role} ${url}`);
    }
  }
  assert.deepEqual(daGoi, ['markPaid', 'archive', 'markPaid', 'archive']);
  await app.close();
});

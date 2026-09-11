import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * vbsec 2026-09-10 (LOW, payrollCalculation.controller.ts:18): `GET /hrm/payroll/calculate` (và
 * `/payroll/sheet-lines`, `/payroll/support-allowances` — cùng tính live) tính lại lương TOÀN CÔNG TY mỗi
 * lượt gọi, chỉ có giới hạn chung 300/phút/IP -> một người dội liên tục là chiếm CPU + DB tenant.
 * Sửa: giới hạn theo người dùng 30 lượt/phút mỗi route.
 *
 * Route THẬT; controller thay bằng bản rỗng (thứ đang kiểm là cấu hình route).
 */

let routes: (app: FastifyInstance) => Promise<void>;

before(async () => {
  const ok = async () => ({ ok: true });
  mock.module(
    '../../controllers/client/hrm/du_lieu_tinh_luong/payrollCalculation.controller',
    {
      namedExports: {
        calculatePreview: ok,
        getSheetLines: ok,
        getSupportAllowances: ok,
      },
    },
  );
  ({ hrmPayrollCalculationRoutes: routes } =
    await import('../../routes/hrm/du_lieu_tinh_luong/payrollCalculation.route'));
});

async function taoApp() {
  const app = Fastify();
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  // Như hrm.route.ts: xác thực ở hook preHandler của plugin cha, trước giới hạn theo người dùng.
  app.addHook('preHandler', async (req: FastifyRequest) => {
    req.user = {
      userId: String(req.headers['x-user']),
      donViId: 'dv-1',
      role: 'OWNER',
      tokenVersion: 0,
    };
  });
  await app.register(routes);
  await app.ready();
  return app;
}

test('mỗi route tính lương: tối đa 30 lượt / phút / người dùng; người khác không bị vạ lây', async () => {
  const app = await taoApp();
  for (const url of [
    '/payroll/calculate?periodId=p1',
    '/payroll/sheet-lines?periodId=p1',
    '/payroll/support-allowances?periodId=p1',
  ]) {
    const ma: number[] = [];
    for (let i = 0; i < 31; i++) {
      ma.push(
        (await app.inject({ url, headers: { 'x-user': 'ke-toan-1' } }))
          .statusCode,
      );
    }
    assert.deepEqual(ma, [...Array(30).fill(200), 429], url);
    assert.equal(
      (await app.inject({ url, headers: { 'x-user': 'ke-toan-2' } }))
        .statusCode,
      200,
      url,
    );
  }
  await app.close();
});

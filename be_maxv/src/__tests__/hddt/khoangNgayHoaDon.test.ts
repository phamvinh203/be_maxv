import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import errorHandlerPlugin from '../../plugins/errorHandler.plugin';

/**
 * vbsec 2026-09-10 (LOW, gdt.service.ts:1209): các endpoint hóa đơn đã lưu không trần khoảng ngày —
 * `/saved-details` kéo nguyên JSON chi tiết của MỌI hóa đơn trong khoảng (100 năm cũng nhận), còn 2
 * endpoint CHẠY CHẶN cũ (`GET /invoices/:direction`, `POST /sync`) giữ request mở mà gọi cổng thuế theo
 * từng tháng của khoảng. Ngày sai định dạng lọt thẳng xuống Prisma thành lỗi 500.
 *
 * Chốt: trần 366 ngày cho `/saved-details` + 2 endpoint chặn cũ; `/saved` (danh sách nhẹ — nút "Sao lưu
 * dữ liệu" cố ý đọc khoảng 2000..2100) và các lượt CHẠY NỀN (có pacer, dừng được) chỉ kiểm ngày hợp lệ.
 */

const goi: string[] = [];
let gdtRoutes: (fastify: FastifyInstance) => Promise<void>;

before(async () => {
  const ghi =
    (ten: string, kq: unknown = {}) =>
    (..._args: unknown[]) => {
      goi.push(ten);
      return kq;
    };
  mock.module('../../services/client/hddt/gdt.service', {
    namedExports: {
      getSavedInvoices: async (...a: unknown[]) =>
        ghi('getSavedInvoices', { total: 0, datas: [], thayThe: [] })(...a),
      getSavedInvoiceDetails: async (...a: unknown[]) =>
        ghi('getSavedInvoiceDetails', [])(...a),
      countDetailComplete: async (...a: unknown[]) =>
        ghi('countDetailComplete', { total: 0, missing: 0 })(...a),
      fetchAndSaveInvoicesInRange: async (...a: unknown[]) =>
        ghi('fetchAndSaveInvoicesInRange', { saved: 0, partial: false })(...a),
      LIST_RETRY_BUDGET_BLOCKING_MS: 1000,
      runSync: async (...a: unknown[]) => ghi('runSync', { ok: true })(...a),
      startSyncRun: ghi('startSyncRun', { active: true }),
      runDetailFetch: ghi('runDetailFetch', { status: { active: true } }),
      startUpdateRun: ghi('startUpdateRun', { active: true }),
    },
  });
  mock.module('../../helpers/resolveTenantDb', {
    namedExports: {
      resolveTenantDb: async () => ({}),
      resolveTenantDbName: async () => 'db',
      resolveTenantInfo: async () => ({
        dbName: 'db',
        maSoThue: '0100000000',
        xemLuong: true,
      }),
    },
  });
  mock.module('../../config/db.sys', {
    namedExports: {
      sysPrisma: {
        donVi: { findFirst: async () => null, update: async () => ({}) },
      },
    },
  });
  ({ default: gdtRoutes } = await import('../../routes/hddt/gdt.route'));
});

beforeEach(() => {
  goi.length = 0;
});

async function taoApp() {
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  app.decorate('authenticate', async (req: FastifyRequest) => {
    req.user = { userId: 'u', donViId: 'dv-1', role: 'OWNER', tokenVersion: 0 };
  });
  await app.register(gdtRoutes);
  await app.ready();
  return app;
}

const TOKEN = { 'x-gdt-token': 'gdt-token' };

test('/saved-details: khoảng > 366 ngày -> 400, không đọc DB; đúng 1 năm vẫn đọc được', async () => {
  const app = await taoApp();

  const rong = await app.inject({
    url: '/invoices/purchase/saved-details?tuNgay=2025-01-01&denNgay=2026-06-30',
  });
  assert.equal(rong.statusCode, 400);
  assert.match(rong.json().message, /366 ngày/);
  assert.deepEqual(goi, []);

  // 2024 là năm nhuận: 01/01..31/12/2024 = 366 ngày -> vẫn trong trần.
  const motNam = await app.inject({
    url: '/invoices/sold/saved-details?tuNgay=2024-01-01&denNgay=2024-12-31',
  });
  assert.equal(motNam.statusCode, 200);
  assert.deepEqual(goi, ['getSavedInvoiceDetails']);
  await app.close();
});

test('/saved: khoảng sao lưu 2000..2100 vẫn cho (danh sách nhẹ); ngày sai định dạng -> 400', async () => {
  const app = await taoApp();

  const saoLuu = await app.inject({
    url: '/invoices/sold/saved?tuNgay=2000-01-01&denNgay=2100-12-31',
  });
  assert.equal(saoLuu.statusCode, 200);
  assert.deepEqual(goi, ['getSavedInvoices']);

  for (const [tu, den] of [
    ['2026-13-01', '2026-12-31'],
    ['2026-02-30', '2026-03-01'],
    ['01/01/2026', '2026-03-01'],
    ['2026-01-01T00:00:00Z', '2026-03-01'],
  ]) {
    const res = await app.inject({
      url: `/invoices/purchase/saved?tuNgay=${encodeURIComponent(tu)}&denNgay=${den}`,
    });
    assert.equal(res.statusCode, 400, `${tu}..${den}`);
    assert.match(res.json().message, /yyyy-MM-dd/);
  }
  assert.deepEqual(goi, ['getSavedInvoices']);
  await app.close();
});

test('/detail-complete: từ ngày sau đến ngày -> 400', async () => {
  const app = await taoApp();
  const res = await app.inject({
    url: '/invoices/purchase/detail-complete?tuNgay=2026-06-30&denNgay=2026-01-01',
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.json().message, /Từ ngày/);
  assert.deepEqual(goi, []);
  await app.close();
});

test('endpoint CHẠY CHẶN cũ (GET /invoices/:direction, POST /sync): khoảng > 366 ngày -> 400, không gọi cổng thuế', async () => {
  const app = await taoApp();

  const tra = await app.inject({
    url: '/invoices/purchase?tuNgay=2020-01-01&denNgay=2026-01-01',
    headers: TOKEN,
  });
  assert.equal(tra.statusCode, 400);
  assert.match(tra.json().message, /366 ngày/);

  const dongBo = await app.inject({
    method: 'POST',
    url: '/sync',
    headers: TOKEN,
    payload: {
      tuNgay: '2020-01-01',
      denNgay: '2026-01-01',
      direction: 'all',
      loai: 'all',
    },
  });
  assert.equal(dongBo.statusCode, 400);
  assert.match(dongBo.json().message, /366 ngày/);
  assert.deepEqual(goi, []);
  await app.close();
});

test('lượt CHẠY NỀN (sync/run, update-run, detail-run): khoảng nhiều năm vẫn cho; ngày sai -> 400', async () => {
  const app = await taoApp();

  const dongBo = await app.inject({
    method: 'POST',
    url: '/sync/run',
    headers: TOKEN,
    payload: {
      tuNgay: '2020-01-01',
      denNgay: '2026-01-01',
      direction: 'all',
      loai: 'all',
    },
  });
  assert.equal(dongBo.statusCode, 200);
  const capNhat = await app.inject({
    method: 'POST',
    url: '/invoices/sold/update-run?tuNgay=2020-01-01&denNgay=2026-01-01',
    headers: TOKEN,
  });
  assert.equal(capNhat.statusCode, 200);
  assert.deepEqual(goi, ['startSyncRun', 'startUpdateRun']);

  const sai = await app.inject({
    method: 'POST',
    url: '/invoices/purchase/detail-run?tuNgay=2026-01-01&denNgay=hom-nay',
    headers: TOKEN,
  });
  assert.equal(sai.statusCode, 400);
  const saiSync = await app.inject({
    method: 'POST',
    url: '/sync/run',
    headers: TOKEN,
    payload: {
      tuNgay: '2026-03-01',
      denNgay: '2026-01-01',
      direction: 'all',
      loai: 'all',
    },
  });
  assert.equal(saiSync.statusCode, 400);
  assert.deepEqual(goi, ['startSyncRun', 'startUpdateRun']);
  await app.close();
});

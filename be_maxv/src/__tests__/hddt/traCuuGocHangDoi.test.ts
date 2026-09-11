import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { TraCuuGocError } from '../../services/client/hddt/traCuuGoc/types';

/**
 * `GET /gdt/tra-cuu-goc` — tải PDF gốc từ cổng NCC, nhiều NCC phải giải captcha bằng OCR (mỗi lượt có
 * thể chạy ~30s, hàng trăm lượt OCR, ~200 request tới NCC).
 *
 * vbsec 2026-09-10 (MEDIUM, traCuuGoc.controller.ts:50): không giới hạn gì ngoài 300/phút/IP -> một
 * người dùng dội là nghẽn CPU + worker OCR dùng chung mọi tenant, NCC chặn IP server.
 * FE tải theo lô TUẦN TỰ (có nút Hủy) nên giới hạn SỐ LƯỢT đồng thời, không phải tốc độ.
 *
 * Route + controller THẬT; bộ tải NCC thay bằng bản giả giữ lượt ở trạng thái đang chạy.
 */

const dangGiu: Array<() => void> = [];

let gdtRoutes: (fastify: FastifyInstance) => Promise<void>;

before(async () => {
  mock.module('../../services/client/hddt/traCuuGoc', {
    namedExports: {
      TraCuuGocError,
      danhMucTraCuuGoc: () => ({ nhaCungCap: [], urlDaDo: {} }),
      taiHoaDonGoc: () =>
        new Promise((resolve) =>
          dangGiu.push(() =>
            resolve({ buffer: Buffer.from('%PDF-1.4'), filename: 'goc.pdf', contentType: 'application/pdf' }),
          ),
        ),
    },
  });
  ({ default: gdtRoutes } = await import('../../routes/hddt/gdt.route'));
});

async function taoApp() {
  const app = Fastify();
  app.decorate('authenticate', async (req: FastifyRequest) => {
    req.user = { userId: String(req.headers['x-user']), donViId: 'dv-1', role: 'OWNER', tokenVersion: 0 };
  });
  await app.register(gdtRoutes);
  await app.ready();
  return app;
}

// `.then()` để request được gửi NGAY (inject của light-my-request chỉ chạy khi có người chờ kết quả).
const taiGoc = (app: FastifyInstance, user: string) =>
  app
    .inject({ method: 'GET', url: '/tra-cuu-goc?msttcgp=0101243150&code=ABC', headers: { 'x-user': user } })
    .then((r) => r);

/** Lượt vượt trần phải bị từ chối NGAY — treo trong hàng đợi chính là lỗ hổng. */
async function phanHoiNgay(p: ReturnType<typeof taiGoc>) {
  const TREO = Symbol('treo');
  const kq = await Promise.race([p, new Promise((r) => setTimeout(() => r(TREO), 300))]);
  assert.notEqual(kq, TREO, 'lượt vượt trần đang TREO thay vì bị từ chối ngay');
  return kq as Awaited<ReturnType<typeof taiGoc>>;
}

test('mỗi người dùng tối đa 2 lượt tải gốc cùng lúc: lượt thứ 3 bị từ chối NGAY (429, BUSY); người khác vẫn tải được', async () => {
  const app = await taoApp();

  const a1 = taiGoc(app, 'user-a');
  const a2 = taiGoc(app, 'user-a');
  while (dangGiu.length < 2) await new Promise((r) => setTimeout(r, 5));
  const a3 = await phanHoiNgay(taiGoc(app, 'user-a'));
  assert.equal(a3.statusCode, 429);
  assert.equal(a3.json().code, 'BUSY');

  const b1 = taiGoc(app, 'user-b');

  // Nhả dần các lượt đang giữ (lượt nào vào hàng thì được nhả khi tới lượt).
  while (dangGiu.length < 3) await new Promise((r) => setTimeout(r, 5));
  dangGiu.splice(0).forEach((nha) => nha());
  const ketQua = await Promise.all([a1, a2, b1]);
  assert.deepEqual(
    ketQua.map((r) => r.statusCode),
    [200, 200, 200],
  );
  await app.close();
});

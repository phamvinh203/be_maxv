import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import errorHandlerPlugin from '../../plugins/errorHandler.plugin';

/**
 * Giới hạn theo người dùng trên các route DVC gọi ra cổng thuế (routes/dich_vu_cong/gdt-dvc.route.ts).
 *
 * vbsec 2026-09-10 (MEDIUM):
 *  - gdt-dvc.route.ts:110 — `POST /dvc/login` không giới hạn, `GET /dvc/captcha` trả luôn đáp án OCR:
 *    server thành proxy giải captcha để dò mật khẩu cổng thuế của MST bất kỳ.
 *  - gdt-dvc.route.ts:40 — mỗi `GET /dvc/captcha` mở phiên cổng mới (2 request + OCR), chỉ có giới
 *    hạn chung 300/phút/IP -> dồn request treo trong hàng đợi gọi cổng.
 *
 * Route THẬT; controller + guard module thay bằng bản rỗng (thứ đang kiểm là cấu hình route).
 */

let gdtDvcRoutes: (fastify: FastifyInstance) => Promise<void>;

before(async () => {
  const ok = async () => ({ ok: true });
  const tenHandler = [
    'captcha',
    'chiTietToKhai',
    'danhSachThongBao',
    'dongBo',
    'tienDoDongBo',
    'getCredential',
    'lichSuDongBo',
    'login',
    'taiFileHoSo',
    'taiLieuDinhKem',
    'taiThongBao',
    'tchsCaptcha',
    'traCuuHoSo',
    'xoaLichSuDongBo',
    'xoaTatCaLichSuDongBo',
    'xuatGtgt01',
    'xuatKhac',
    'xuatQtt05',
    'xuatTncn05',
    'xuatTndn03',
    'xuatXml',
  ];
  mock.module('../../controllers/client/dich_vu_cong/gdt-dvc.controller', {
    namedExports: Object.fromEntries(tenHandler.map((t) => [t, ok])),
  });
  mock.module('../../services/shared/modules.service', {
    namedExports: { requireModule: () => async () => {} },
  });
  mock.module('../../helpers/dich_vu_cong/kiemCongTyDangChon', {
    namedExports: { kiemCongTyDangChon: async () => {} },
  });
  ({ default: gdtDvcRoutes } =
    await import('../../routes/dich_vu_cong/gdt-dvc.route'));
});

async function taoApp() {
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  app.decorate('authenticate', async (req: FastifyRequest) => {
    req.user = {
      userId: String(req.headers['x-user']),
      donViId: 'dv-1',
      role: 'OWNER',
      tokenVersion: 0,
    };
  });
  await app.register(gdtDvcRoutes);
  await app.ready();
  return app;
}

async function maTraVe(
  app: FastifyInstance,
  method: 'GET' | 'POST',
  url: string,
  user: string,
  soLan: number,
) {
  const ma: number[] = [];
  for (let i = 0; i < soLan; i++) {
    ma.push(
      (await app.inject({ method, url, headers: { 'x-user': user } }))
        .statusCode,
    );
  }
  return ma;
}

const toiDa = (n: number) => [...Array(n).fill(200), 429];

test('POST /login: tối đa 10 lượt / 10 phút / người dùng; người khác không bị ảnh hưởng', async () => {
  // Cũng là test chặn lỗi LÂY giới hạn: @fastify/rate-limit gắn hook bằng cách push vào mảng preHandler
  // của route và chỉ chạy hook ĐẦU TIÊN của mỗi request. Route dùng chung một mảng guard thì /login
  // (đăng ký sau /captcha) chạy hook 20/phút của /captcha trước. Route KHÔNG có giới hạn riêng (vd
  // /ho-so) không lộ lỗi này: hook toàn cục ở onRequest đã chạy trước nên hook lây sang bị bỏ qua.
  const app = await taoApp();
  assert.deepEqual(
    await maTraVe(app, 'POST', '/login', 'user-a', 11),
    toiDa(10),
  );
  assert.deepEqual(await maTraVe(app, 'POST', '/login', 'user-b', 1), [200]);
  await app.close();
});

test('GET /captcha và /tchs/captcha: tối đa 20 lượt / phút / người dùng', async () => {
  const app = await taoApp();
  assert.deepEqual(
    await maTraVe(app, 'GET', '/captcha', 'user-a', 21),
    toiDa(20),
  );
  assert.deepEqual(
    await maTraVe(app, 'GET', '/tchs/captcha', 'user-a', 21),
    toiDa(20),
  );
  await app.close();
});

test('POST /dong-bo: tối đa 10 lượt / 10 phút / người dùng', async () => {
  const app = await taoApp();
  assert.deepEqual(
    await maTraVe(app, 'POST', '/dong-bo', 'user-a', 11),
    toiDa(10),
  );
  await app.close();
});

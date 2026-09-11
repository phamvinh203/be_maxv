import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import errorHandlerPlugin from '../../plugins/errorHandler.plugin';

/**
 * Giới hạn trên các route nặng của mô-đun Tờ khai (routes/to_khai/toKhai.route.ts).
 *
 * vbsec 2026-09-10 (MEDIUM, toKhai.route.ts:32): `POST /to-khai/ke-khai` quét toàn bộ hóa đơn thay
 * thế/điều chỉnh của tenant (không lọc ngày) bằng N+1 truy vấn tuần tự, không giới hạn route, không khóa
 * đồng thời -> dội song song là cạn pool Postgres dùng chung. Hai lượt kê khai cùng công ty chạy chồng
 * nhau còn gỡ/gán xen kẽ trên cùng bảng kê.
 *
 * Route + controller kê khai THẬT; service, tra DB tenant, guard module và controller tờ khai thay bằng
 * bản giả (thứ đang kiểm là cấu hình route + khóa đồng thời ở controller).
 */

const cheDo = { giu: false };
const dangGiu: Array<() => void> = [];

let toKhaiRoutes: (fastify: FastifyInstance) => Promise<void>;

before(async () => {
  const ok = async () => ({ ok: true });
  mock.module('../../controllers/client/to_khai/toKhaiGtgt01.controller', {
    namedExports: Object.fromEntries(
      [
        'chot',
        'danhSach',
        'doc',
        'luu',
        'luuPhuLuc',
        'moKhoa',
        'tinh',
        'xuatXml',
      ].map((t) => [t, ok]),
    ),
  });
  mock.module('../../services/client/to_khai/application/keKhaiKy.service', {
    namedExports: {
      danhDauKy: () => {
        const ketQua = {
          purchase: 0,
          sold: 0,
          khongRoKyGoc: 0,
          daGo: 0,
          daGoKhongRoKyGoc: 0,
          giuKyChot: 0,
          kyChotDangGiu: [],
        };
        if (!cheDo.giu) return Promise.resolve(ketQua);
        return new Promise((resolve) => dangGiu.push(() => resolve(ketQua)));
      },
      layBangKeTheoKy: async () => ({ total: 0, datas: [], thayThe: {} }),
      capNhatQuyetDinh: async () => {},
      locQuyetDinh: () => ({}),
    },
  });
  // Mỗi công ty một DB tenant: header `x-cong-ty` quyết định request thuộc DB nào.
  const tenDb = (req: FastifyRequest) =>
    `db_${String(req.headers['x-cong-ty'] ?? 'a')}`;
  mock.module('../../helpers/resolveTenantDb', {
    namedExports: {
      resolveTenantDbName: async (req: FastifyRequest) => tenDb(req),
      resolveTenantDb: async () => ({}),
      resolveTenantInfo: async (req: FastifyRequest) => ({
        dbName: tenDb(req),
        maSoThue: '0100000000',
        xemLuong: true,
      }),
    },
  });
  mock.module('../../helpers/tenantClient', {
    namedExports: { getTenantDb: () => ({}) },
  });
  mock.module('../../services/shared/modules.service', {
    namedExports: { requireModule: () => async () => {} },
  });
  ({ default: toKhaiRoutes } =
    await import('../../routes/to_khai/toKhai.route'));
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
  await app.register(toKhaiRoutes);
  await app.ready();
  return app;
}

const KY = { nam: 2026, kyLoai: 'thang', kySo: 8 };

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
      (
        await app.inject({
          method,
          url,
          headers: { 'x-user': user },
          payload: method === 'POST' ? KY : undefined,
        })
      ).statusCode,
    );
  }
  return ma;
}

const toiDa = (n: number) => [...Array(n).fill(200), 429];

test('POST /ke-khai: tối đa 10 lượt / phút / người dùng; người khác không bị ảnh hưởng', async () => {
  cheDo.giu = false;
  const app = await taoApp();
  assert.deepEqual(
    await maTraVe(app, 'POST', '/ke-khai', 'user-a', 11),
    toiDa(10),
  );
  assert.deepEqual(await maTraVe(app, 'POST', '/ke-khai', 'user-b', 1), [200]);
  await app.close();
});

test('POST /gtgt01/tinh: tối đa 20 lượt / phút / người dùng — không nhiễm trần 10 của /ke-khai', async () => {
  // @fastify/rate-limit gắn hook bằng cách push vào mảng preHandler của route và chỉ chạy hook ĐẦU TIÊN
  // của mỗi request. Route dùng chung một mảng guard thì /gtgt01/tinh (đăng ký sau /ke-khai) chạy hook
  // của /ke-khai trước -> dính trần 10. Route KHÔNG có giới hạn riêng (vd /hoa-don) không lộ lỗi này:
  // hook toàn cục ở onRequest đã chạy trước nên hook lây sang bị bỏ qua.
  const app = await taoApp();
  assert.deepEqual(
    await maTraVe(app, 'POST', '/gtgt01/tinh', 'user-a', 21),
    toiDa(20),
  );
  await app.close();
});

// `.then()` để request được gửi NGAY (inject của light-my-request chỉ chạy khi có người chờ kết quả).
const keKhai = (app: FastifyInstance, user: string, congTy: string) =>
  app
    .inject({
      method: 'POST',
      url: '/ke-khai',
      headers: { 'x-user': user, 'x-cong-ty': congTy },
      payload: KY,
    })
    .then((r) => r);

/** Lượt bị khóa phải bị từ chối NGAY — treo chờ chính là giữ request trong RAM. */
async function phanHoiNgay(p: ReturnType<typeof keKhai>) {
  const TREO = Symbol('treo');
  const kq = await Promise.race([
    p,
    new Promise((r) => setTimeout(() => r(TREO), 300)),
  ]);
  assert.notEqual(kq, TREO, 'lượt thứ hai đang TREO thay vì bị từ chối ngay');
  return kq as Awaited<ReturnType<typeof keKhai>>;
}

test('mỗi công ty chỉ 1 lượt kê khai chạy cùng lúc: lượt thứ hai (kể cả người khác) bị từ chối NGAY; công ty khác vẫn chạy', async () => {
  cheDo.giu = true;
  const app = await taoApp();

  const a1 = keKhai(app, 'user-a', 'a');
  while (dangGiu.length < 1) await new Promise((r) => setTimeout(r, 5));
  const a2 = await phanHoiNgay(keKhai(app, 'user-b', 'a'));
  assert.equal(a2.statusCode, 429);

  const b1 = keKhai(app, 'user-c', 'b');
  while (dangGiu.length < 2) await new Promise((r) => setTimeout(r, 5));

  dangGiu.splice(0).forEach((nha) => nha());
  assert.deepEqual(
    (await Promise.all([a1, b1])).map((r) => r.statusCode),
    [200, 200],
  );

  // Lượt trước xong thì công ty đó kê khai tiếp được.
  cheDo.giu = false;
  assert.equal((await keKhai(app, 'user-b', 'a')).statusCode, 200);
  await app.close();
});

import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import errorHandlerPlugin from '../../plugins/errorHandler.plugin';

/**
 * vbsec 2026-09-10 (LOW, gdt-dvc.controller.ts:379 + gnt.controller.ts:31): tra cứu hồ sơ / GNT / lịch sử
 * đồng bộ trả NGUYÊN `err.message` về client — với lỗi Prisma là cả đường dẫn file nguồn, đoạn code, tên
 * bảng/cột. Query không được kiểm: `tuNgay=2026-13-45` ra Invalid Date, `maHoSo` lặp 2 lần thành mảng —
 * cả hai rơi xuống Prisma thành đúng loại lỗi đó. Sửa: kiểm query bằng Zod (400) + thông điệp an toàn.
 *
 * Handler THẬT; service đọc DB tenant thay bằng bản giả.
 */

class PrismaClientValidationError extends Error {
  override name = 'PrismaClientValidationError';
}
const LOI_PRISMA = new PrismaClientValidationError(
  'Invalid `tenantDb.dvc_ho_so.findMany()` invocation in\nC:\\srv\\be_maxv\\src\\services\\client\\dich_vu_cong\\dvc-dong-bo.service.ts:696:43',
);

const goi: string[] = [];
let nemLoi = true;
let app: FastifyInstance;

before(async () => {
  const gia =
    (ten: string, kq: unknown) =>
    async (..._a: unknown[]) => {
      goi.push(ten);
      if (nemLoi) throw LOI_PRISMA;
      return kq;
    };
  mock.module('../../services/client/dich_vu_cong/dvc-dong-bo.service', {
    namedExports: {
      timHoSoDaDongBo: gia('timHoSoDaDongBo', { headers: [], rows: [] }),
      layDsToKhaiGtgt01DaLuu: gia('layDsToKhaiGtgt01DaLuu', []),
      layDsToKhaiQtt05DaLuu: gia('x', []),
      layDsToKhaiTncn05DaLuu: gia('x', []),
      layDsToKhaiTndn03DaLuu: gia('x', []),
      layDsToKhaiKhacDaLuu: gia('x', []),
      layDsXmlToKhaiDaLuu: gia('x', []),
      layLichSuDongBo: gia('layLichSuDongBo', []),
      xoaLichSuDongBo: gia('xoaLichSuDongBo', 1),
      xoaTatCaLichSuDongBo: gia('xoaTatCaLichSuDongBo', 1),
    },
  });
  mock.module(
    '../../services/client/dich_vu_cong/giay_nop_tien/dvc-gnt-dong-bo.service',
    {
      namedExports: {
        timGiayNopTienDaDongBo: gia('timGiayNopTienDaDongBo', {
          headers: [],
          rows: [],
        }),
      },
    },
  );
  mock.module('../../helpers/resolveTenantDb', {
    namedExports: {
      resolveTenantDb: async () => ({}),
      resolveTenantDbName: async () => 'db',
    },
  });
  mock.module('../../config/db.sys', {
    namedExports: { sysPrisma: { donVi: { findFirst: async () => null } } },
  });
  const dvc =
    await import('../../controllers/client/dich_vu_cong/gdt-dvc.controller');
  const gnt =
    await import('../../controllers/client/dich_vu_cong/giay_nop_tien/gnt.controller');

  app = Fastify();
  await app.register(errorHandlerPlugin);
  app.addHook('onRequest', async (req: FastifyRequest) => {
    req.user = { userId: 'u', donViId: 'dv-1', role: 'OWNER', tokenVersion: 0 };
  });
  app.get('/ho-so', dvc.traCuuHoSo);
  app.get('/xuat/gtgt01', dvc.xuatGtgt01);
  app.get('/dong-bo/lich-su', dvc.lichSuDongBo);
  app.delete('/dong-bo/lich-su/:id', dvc.xoaLichSuDongBo);
  app.delete('/dong-bo/lich-su', dvc.xoaTatCaLichSuDongBo);
  app.get('/giay-nop-tien', gnt.traCuuGiayNopTien);
  await app.ready();
});

beforeEach(() => {
  goi.length = 0;
  nemLoi = true;
});

function khongLoChiTiet(body: string) {
  assert.doesNotMatch(body, /invocation|dvc-dong-bo\.service|findMany|C:\\\\/);
}

test('lỗi Prisma khi tra cứu/xem/xóa: client chỉ nhận câu chung, không lộ đường dẫn/đoạn truy vấn', async () => {
  for (const [method, url, ma] of [
    ['GET', '/ho-so?tuNgay=2026-01-01&denNgay=2026-01-31', 400],
    ['GET', '/xuat/gtgt01?tuNgay=2026-01-01', 400],
    ['GET', '/dong-bo/lich-su', 500],
    ['DELETE', '/dong-bo/lich-su/abc', 500],
    ['DELETE', '/dong-bo/lich-su', 500],
    ['GET', '/giay-nop-tien?soGnt=123', 400],
  ] as const) {
    const res = await app.inject({ method, url });
    assert.equal(res.statusCode, ma, `${method} ${url}`);
    khongLoChiTiet(res.body);
    assert.ok(res.json().message, `${method} ${url} phải có message`);
  }
});

test('thanLoi (captcha/đăng nhập/tải file DVC): lỗi nội bộ -> câu mặc định; lỗi nghiệp vụ vẫn hiện nguyên', async () => {
  const { thanLoi } =
    await import('../../controllers/client/dich_vu_cong/gdt-dvc.controller');
  const MAC_DINH = 'Tải file hồ sơ thất bại.';
  const heThong = Object.assign(
    new Error('connect ECONNREFUSED 10.0.0.5:443'),
    { code: 'ECONNREFUSED' },
  );

  assert.equal(thanLoi(LOI_PRISMA, MAC_DINH).message, MAC_DINH);
  assert.equal(
    thanLoi(
      new TypeError("Cannot read properties of undefined (reading 'raw')"),
      MAC_DINH,
    ).message,
    MAC_DINH,
  );
  assert.equal(thanLoi(heThong, MAC_DINH).message, MAC_DINH);
  assert.equal(
    thanLoi(new Error('Không tìm thấy hồ sơ trên cổng.'), MAC_DINH).message,
    'Không tìm thấy hồ sơ trên cổng.',
  );
});

test('query sai (ngày không có thật, tham số lặp thành mảng, chuỗi quá dài) -> 400, không xuống DB', async () => {
  nemLoi = false;
  for (const url of [
    '/ho-so?tuNgay=2026-13-45',
    '/ho-so?denNgay=31/01/2026',
    '/ho-so?maHoSo=a&maHoSo=b',
    `/ho-so?maToKhai=${'x'.repeat(201)}`,
    '/xuat/gtgt01?tuNgay=2026-02-30',
    '/giay-nop-tien?maGiaoDich=a&maGiaoDich=b',
    '/giay-nop-tien?denNgay=hom-nay',
  ]) {
    const res = await app.inject({ method: 'GET', url });
    assert.equal(res.statusCode, 400, url);
  }
  assert.deepEqual(goi, []);

  // Ô trống FE gửi "" vẫn là "không lọc", không phải lỗi.
  const trong = await app.inject({
    method: 'GET',
    url: '/ho-so?tuNgay=&denNgay=&maHoSo=&maToKhai=',
  });
  assert.equal(trong.statusCode, 200);
  assert.deepEqual(goi, ['timHoSoDaDongBo']);
});

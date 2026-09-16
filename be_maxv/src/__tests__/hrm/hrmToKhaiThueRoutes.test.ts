import { before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import errorHandlerPlugin from '../../plugins/errorHandler.plugin';

/**
 * Nối route `to_khai_thue` + ma trận quyền 2 mức (api-contract Mục 0.1, Mục 1, Mục 9 điểm 8).
 *
 * Đi qua HTTP thật của Fastify (`app.inject`) nhưng KHÔNG chạm DB: quyền phải chặn TRƯỚC mọi truy vấn,
 * nên DB giả ở đây ném lỗi ngay khi bị đụng tới — endpoint nào lọt quyền mà vẫn đọc DB sẽ ra 500 chứ
 * không ra 403, và ca kiểm thấy ngay.
 */

interface TestUser {
  userId: string;
  donViId: string;
  role: string;
  tokenVersion: number;
}

const OWNER: TestUser = {
  userId: 'u-owner',
  donViId: 'dv-1',
  role: 'OWNER',
  tokenVersion: 1,
};
const KE_TOAN: TestUser = {
  userId: 'u-ke-toan',
  donViId: 'dv-1',
  role: 'OWNER_EMPLOYEE',
  tokenVersion: 1,
};

let nguoiDung: TestUser = OWNER;
let xemLuong = true;
let hrmToKhaiThueRoutes: typeof import('../../routes/hrm/to_khai_thue/toKhaiThue.route').hrmToKhaiThueRoutes;

/** DB giả: đụng vào là ném lỗi (trừ `then`, để `await` trên nó không tự nổ). */
const DB_CAM_CHAM = new Proxy(
  {},
  {
    get: (_dich, khoa) => {
      if (khoa === 'then') return undefined;
      throw new Error(
        `Không được chạm DB trước khi qua quyền (đọc "${String(khoa)}")`,
      );
    },
  },
);

before(async () => {
  mock.module('../../helpers/resolveTenantDb', {
    namedExports: {
      resolveTenantDb: async () => DB_CAM_CHAM,
      resolveTenantCtx: async () => ({
        db: DB_CAM_CHAM,
        dbName: 'test-db',
        maSoThue: '0000000000',
        xemLuong,
      }),
      assertXemLuong: () => {},
      currentUserId: (req: { user?: TestUser }) => req.user?.userId,
    },
  });
  mock.module('../../services/shared/syslog.service', {
    namedExports: { writeLog: async () => {} },
  });
  mock.module('../../config/db.sys', { namedExports: { sysPrisma: {} } });
  ({ hrmToKhaiThueRoutes } =
    await import('../../routes/hrm/to_khai_thue/toKhaiThue.route'));
});

beforeEach(() => {
  nguoiDung = OWNER;
  xemLuong = true;
});

async function taoApp() {
  const app = Fastify({ logger: false });
  app.addHook('onRequest', async (req) => {
    (req as unknown as { user: TestUser }).user = nguoiDung;
  });
  await app.register(errorHandlerPlugin);
  await app.register(hrmToKhaiThueRoutes);
  await app.ready();
  return app;
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
type MucQuyen = 'LUONG' | 'QUAN_TRI';

/** 23 endpoint: 22 của Mục 1 + tải lại file tờ khai (Mục 5.8). */
const ENDPOINT: Array<[Method, string, MucQuyen]> = [
  ['GET', '/to-khai-thue/income-categories', 'LUONG'],
  ['GET', '/to-khai-thue/income-categories/:id', 'LUONG'],
  ['POST', '/to-khai-thue/income-categories', 'LUONG'],
  ['PUT', '/to-khai-thue/income-categories/:id', 'LUONG'],
  ['DELETE', '/to-khai-thue/income-categories/:id', 'LUONG'],
  ['GET', '/to-khai-thue/other-income', 'LUONG'],
  ['GET', '/to-khai-thue/other-income/:id', 'LUONG'],
  ['POST', '/to-khai-thue/other-income/preview', 'LUONG'],
  ['POST', '/to-khai-thue/other-income', 'LUONG'],
  ['PUT', '/to-khai-thue/other-income/:id', 'LUONG'],
  ['DELETE', '/to-khai-thue/other-income/:id', 'LUONG'],
  ['GET', '/to-khai-thue/tax-calculation', 'LUONG'],
  ['POST', '/to-khai-thue/tax-calculation/lock', 'LUONG'],
  ['POST', '/to-khai-thue/tax-calculation/unlock', 'QUAN_TRI'],
  ['GET', '/to-khai-thue/05-kk-tncn', 'LUONG'],
  ['GET', '/to-khai-thue/05-kk-tncn/periods', 'LUONG'],
  ['PUT', '/to-khai-thue/05-kk-tncn/overrides', 'LUONG'],
  ['DELETE', '/to-khai-thue/05-kk-tncn/overrides', 'LUONG'],
  ['POST', '/to-khai-thue/05-kk-tncn/export', 'QUAN_TRI'],
  ['GET', '/to-khai-thue/05-kk-tncn/detail-sheet', 'LUONG'],
  ['POST', '/to-khai-thue/05-kk-tncn/mark-submitted', 'QUAN_TRI'],
  ['GET', '/to-khai-thue/tax-policies', 'LUONG'],
  ['GET', '/to-khai-thue/05-kk-tncn/file', 'QUAN_TRI'],
];

/** Route nháp đã bỏ (api-contract Mục 0.6). */
const ROUTE_NHAP_DA_BO: Array<[Method, string]> = [
  ['POST', '/to-khai-thue/other-income/batch-apply'],
  ['POST', '/to-khai-thue/other-income/delete-all'],
  ['POST', '/to-khai-thue/other-income/delete-employee'],
  ['PUT', '/to-khai-thue/05-kk-tncn/ghi-de'],
  ['DELETE', '/to-khai-thue/05-kk-tncn/ghi-de'],
  ['POST', '/to-khai-thue/05-kk-tncn/chot'],
  ['POST', '/to-khai-thue/05-kk-tncn/mo-khoa'],
  ['GET', '/to-khai-thue/05-kk-tncn/export-xml'],
];

async function goi(
  app: Awaited<ReturnType<typeof taoApp>>,
  method: Method,
  url: string,
) {
  const coThan = method === 'POST' || method === 'PUT';
  const res = await app.inject({
    method,
    url: url.replace(':id', 'khong-co'),
    ...(coThan ? { payload: {} } : {}),
  });
  let code: unknown;
  try {
    code = (JSON.parse(res.body) as { code?: unknown }).code;
  } catch {
    code = undefined;
  }
  return { status: res.statusCode, code };
}

test('Mục 1: đủ 23 endpoint của hợp đồng; 8 route nháp đã bỏ không còn', async () => {
  const app = await taoApp();
  assert.equal(ENDPOINT.length, 23);
  for (const [method, url] of ENDPOINT) {
    assert.ok(app.hasRoute({ method, url }), `thiếu ${method} ${url}`);
  }
  for (const [method, url] of ROUTE_NHAP_DA_BO) {
    assert.ok(
      !app.hasRoute({ method, url }),
      `route nháp còn sót: ${method} ${url}`,
    );
  }
  await app.close();
});

test('Mục 9 điểm 8: không có quyền xem lương -> cả 23 endpoint 403 E-tkt-014, không chạm DB', async () => {
  nguoiDung = KE_TOAN;
  xemLuong = false;
  const app = await taoApp();
  for (const [method, url] of ENDPOINT) {
    const res = await goi(app, method, url);
    assert.equal(res.status, 403, `${method} ${url}`);
    assert.equal(res.code, 'E-tkt-014', `${method} ${url}`);
  }
  await app.close();
});

test('Mục 9 điểm 8: có quyền lương nhưng không phải ADMIN/OWNER -> đúng 4 endpoint mức 2 bị 403 E-tkt-014', async () => {
  nguoiDung = KE_TOAN;
  xemLuong = true;
  const app = await taoApp();
  for (const [method, url, muc] of ENDPOINT) {
    const res = await goi(app, method, url);
    if (muc === 'QUAN_TRI') {
      assert.equal(res.status, 403, `${method} ${url}`);
      assert.equal(res.code, 'E-tkt-014', `${method} ${url}`);
    } else {
      assert.notEqual(
        res.status,
        403,
        `${method} ${url} không được chặn quyền`,
      );
    }
  }
  await app.close();
});

test('OWNER qua được cả hai mức quyền ở mọi endpoint', async () => {
  const app = await taoApp();
  for (const [method, url] of ENDPOINT) {
    const res = await goi(app, method, url);
    assert.notEqual(res.status, 403, `${method} ${url}`);
  }
  await app.close();
});

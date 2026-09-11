import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';

/**
 * Mật khẩu cổng HĐĐT đã lưu của công ty (gdt.controller.ts).
 *
 * vbsec 2026-09-10 (MEDIUM, gdt.controller.ts:144): `GET /gdt/credential` giải mã và trả MẬT KHẨU cổng thuế
 * dạng rõ cho mọi người có quyền vào công ty (kể cả nhân viên) để FE điền sẵn. Sửa: chỉ báo "đã lưu",
 * lúc đăng nhập FE gửi cờ `dungMatKhauDaLuu` và backend tự giải mã dùng — mật khẩu không về trình duyệt.
 *
 * Handler THẬT; DB control plane + dịch vụ gọi cổng thuế thay bằng bản giả (không gọi mạng).
 */

process.env.GDT_CRED_ENC_KEY = randomBytes(32).toString('base64');

const MST = '0101243150';
const MAT_KHAU_THAT = 'mat-khau-cong-thue-that';

const congNhan: Array<{ mst: string; password: string }> = [];
const daGhi: Array<Record<string, unknown>> = [];
let congTy: Record<string, unknown> | null = null;

let app: FastifyInstance;

before(async () => {
  const { encryptGdtPassword } =
    await import('../../services/client/hddt/gdtCredential');
  const blob = encryptGdtPassword(MAT_KHAU_THAT)!;
  congTy = {
    id: 'dv-1',
    maSoThue: MST,
    gdtPasswordCipher: blob.cipher,
    gdtPasswordIv: blob.iv,
    gdtPasswordTag: blob.tag,
  };

  mock.module('../../config/db.sys', {
    namedExports: {
      sysPrisma: {
        donVi: {
          findFirst: async () => congTy,
          update: async ({ data }: { data: Record<string, unknown> }) => {
            daGhi.push(data);
            return {};
          },
        },
      },
    },
  });
  mock.module('../../services/client/hddt/gdt.service', {
    namedExports: {
      login: async (body: { mst: string; password: string }) => {
        congNhan.push({ mst: body.mst, password: body.password });
        return { token: 'gdt-token' };
      },
    },
  });
  const { getGdtCredential, login } =
    await import('../../controllers/client/hddt/gdt.controller');

  app = Fastify();
  app.addHook('onRequest', async (req: FastifyRequest) => {
    req.user = {
      userId: 'nhan-vien-1',
      donViId: 'dv-1',
      role: 'OWNER_EMPLOYEE',
      tokenVersion: 0,
    };
  });
  app.get('/credential', getGdtCredential);
  app.post('/login', login);
  await app.ready();
});

beforeEach(() => {
  congNhan.length = 0;
  daGhi.length = 0;
});

const dangNhap = (payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/login', payload });

test('GET /credential KHÔNG trả mật khẩu về trình duyệt — chỉ báo đã lưu', async () => {
  const res = await app.inject({ method: 'GET', url: '/credential' });

  assert.equal(res.statusCode, 200);
  assert.ok(!res.body.includes(MAT_KHAU_THAT), 'lộ mật khẩu cổng thuế');
  assert.deepEqual(res.json(), { hasSaved: true });
});

test('đăng nhập bằng mật khẩu đã lưu (không gửi mật khẩu): backend tự giải mã dùng, không ghi lại', async () => {
  const res = await dangNhap({
    mst: MST,
    captcha: 'abc',
    key: 'k',
    dungMatKhauDaLuu: true,
  });

  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(congNhan, [{ mst: MST, password: MAT_KHAU_THAT }]);
  assert.equal(daGhi.length, 0);
});

test('mật khẩu đã lưu CHỈ dùng cho đúng MST công ty đang chọn — MST khác -> 400, không gọi cổng', async () => {
  const res = await dangNhap({
    mst: '0309999999',
    captcha: 'abc',
    key: 'k',
    dungMatKhauDaLuu: true,
  });

  assert.equal(res.statusCode, 400);
  assert.equal(congNhan.length, 0);
});

test('gõ mật khẩu mới: đăng nhập bằng mật khẩu gõ và lưu lại (mã hóa)', async () => {
  const res = await dangNhap({
    mst: MST,
    password: 'mat-khau-moi',
    captcha: 'abc',
    key: 'k',
  });

  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(congNhan, [{ mst: MST, password: 'mat-khau-moi' }]);
  assert.equal(daGhi.length, 1);
  assert.ok(!JSON.stringify(daGhi[0]).includes('mat-khau-moi'));

  // Bản lưu GẮN với công ty (AAD): chép sang dòng công ty khác thì không giải mã được.
  const { decryptGdtPassword, nguCanhMatKhauGdt } =
    await import('../../services/client/hddt/gdtCredential');
  const blob = {
    cipher: String(daGhi[0].gdtPasswordCipher),
    iv: String(daGhi[0].gdtPasswordIv),
    tag: String(daGhi[0].gdtPasswordTag),
  };
  assert.equal(decryptGdtPassword(blob, nguCanhMatKhauGdt('dv-1')), 'mat-khau-moi');
  assert.equal(decryptGdtPassword(blob, nguCanhMatKhauGdt('dv-2')), null);
});

test('không mật khẩu, không cờ dùng mật khẩu đã lưu -> 400', async () => {
  const res = await dangNhap({ mst: MST, captcha: 'abc', key: 'k' });

  assert.equal(res.statusCode, 400);
  assert.equal(congNhan.length, 0);
});

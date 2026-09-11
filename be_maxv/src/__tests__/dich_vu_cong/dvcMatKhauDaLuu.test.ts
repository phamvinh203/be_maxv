import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';

/**
 * Tài khoản cổng Dịch vụ công đã lưu của công ty (gdt-dvc.controller.ts).
 *
 * vbsec 2026-09-10 (MEDIUM, gdt-dvc.controller.ts:273): `GET /dvc/credential` trả mật khẩu DVC/eTax đã giải
 * mã cho mọi nhân viên có quyền vào công ty. Sửa: chỉ trả tên đăng nhập + cờ "đã lưu mật khẩu"; lúc đăng
 * nhập FE gửi `dungMatKhauDaLuu` và backend tự giải mã dùng — mật khẩu không về trình duyệt.
 *
 * Handler THẬT; DB control plane + dịch vụ gọi cổng thay bằng bản giả (không gọi mạng).
 */

process.env.GDT_CRED_ENC_KEY = randomBytes(32).toString('base64');

const TEN_DN = '0101243150-ql';
const MAT_KHAU_THAT = 'mat-khau-dvc-that';

const congNhan: Array<{ tenDN: string; matKhau: string }> = [];
const daGhi: Array<Record<string, unknown>> = [];

let app: FastifyInstance;

before(async () => {
  const { encryptGdtPassword } =
    await import('../../services/client/hddt/gdtCredential');
  const blob = encryptGdtPassword(MAT_KHAU_THAT)!;
  const congTy = {
    id: 'dv-1',
    maSoThue: '0101243150',
    dvcUsername: TEN_DN,
    dvcPasswordCipher: blob.cipher,
    dvcPasswordIv: blob.iv,
    dvcPasswordTag: blob.tag,
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
  class LoiGia extends Error {}
  mock.module('../../services/client/dich_vu_cong/gdt-dvc.service', {
    namedExports: {
      login: async (body: { tenDN: string; matKhau: string }) => {
        congNhan.push({ tenDN: body.tenDN, matKhau: body.matKhau });
        return { key: 'k', data: {} };
      },
      toUserMessage: (_e: unknown, macDinh: string) => macDinh,
      DvcAutoLoginFailedError: LoiGia,
      DvcSessionExpiredError: LoiGia,
      MA_LOI_TU_DANG_NHAP_HONG: 'x',
    },
  });
  const { getCredential, login } =
    await import('../../controllers/client/dich_vu_cong/gdt-dvc.controller');

  app = Fastify();
  app.addHook('onRequest', async (req: FastifyRequest) => {
    req.user = {
      userId: 'nhan-vien-1',
      donViId: 'dv-1',
      role: 'OWNER_EMPLOYEE',
      tokenVersion: 0,
    };
  });
  app.get('/credential', getCredential);
  app.post('/login', login);
  await app.ready();
});

beforeEach(() => {
  congNhan.length = 0;
  daGhi.length = 0;
});

const dangNhap = (payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/login', payload });

test('GET /credential KHÔNG trả mật khẩu — chỉ tên đăng nhập + cờ đã lưu', async () => {
  const res = await app.inject({ method: 'GET', url: '/credential' });

  assert.equal(res.statusCode, 200);
  assert.ok(!res.body.includes(MAT_KHAU_THAT), 'lộ mật khẩu DVC');
  assert.deepEqual(res.json(), { username: TEN_DN, hasSavedPassword: true });
});

test('đăng nhập bằng mật khẩu đã lưu: backend tự giải mã dùng, không ghi lại', async () => {
  const res = await dangNhap({
    key: 'k',
    tenDN: TEN_DN,
    captcha: 'abc',
    dungMatKhauDaLuu: true,
  });

  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(congNhan, [{ tenDN: TEN_DN, matKhau: MAT_KHAU_THAT }]);
  assert.equal(daGhi.length, 0);
});

test('mật khẩu đã lưu CHỈ dùng với đúng tên đăng nhập đã lưu — tên khác -> 400, không gọi cổng', async () => {
  const res = await dangNhap({
    key: 'k',
    tenDN: '0309999999-ql',
    captcha: 'abc',
    dungMatKhauDaLuu: true,
  });

  assert.equal(res.statusCode, 400);
  assert.equal(congNhan.length, 0);
});

test('gõ mật khẩu mới: đăng nhập bằng mật khẩu gõ và lưu lại (mã hóa)', async () => {
  const res = await dangNhap({
    key: 'k',
    tenDN: TEN_DN,
    matKhau: 'mat-khau-moi',
    captcha: 'abc',
  });

  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(congNhan, [{ tenDN: TEN_DN, matKhau: 'mat-khau-moi' }]);
  assert.equal(daGhi.length, 1);
  assert.ok(!JSON.stringify(daGhi[0]).includes('mat-khau-moi'));

  // Bản lưu GẮN với công ty + tên đăng nhập (AAD): đổi `dvcUsername` trong DB, hay chép sang công ty
  // khác, thì mật khẩu không còn giải mã được.
  const { decryptGdtPassword, nguCanhMatKhauDvc } =
    await import('../../services/client/hddt/gdtCredential');
  const blob = {
    cipher: String(daGhi[0].dvcPasswordCipher),
    iv: String(daGhi[0].dvcPasswordIv),
    tag: String(daGhi[0].dvcPasswordTag),
  };
  assert.equal(decryptGdtPassword(blob, nguCanhMatKhauDvc('dv-1', TEN_DN)), 'mat-khau-moi');
  assert.equal(decryptGdtPassword(blob, nguCanhMatKhauDvc('dv-1', '0309999999-ql')), null);
  assert.equal(decryptGdtPassword(blob, nguCanhMatKhauDvc('dv-2', TEN_DN)), null);
});

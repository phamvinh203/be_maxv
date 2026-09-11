import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';

/**
 * vbsec 2026-09-10 (LOW, taiLieu.controller.ts:365): xem file scan trả `inline` với Content-Type lấy từ
 * loại file Drive báo về. File nằm trên Drive CỦA KHÁCH — đổi loại/thay nội dung lúc nào cũng được — nên
 * một file `text/html` / `image/svg+xml` được mở NGAY TRÊN ORIGIN API (chạy script bằng cookie phiên).
 * Sửa: chỉ loại trong danh sách ảnh/PDF được xem `inline`; loại khác trả `application/octet-stream` +
 * `attachment` (tải xuống, không hiển thị).
 *
 * Controller THẬT; service Drive + DB thay bằng bản giả.
 */

let mimeDrive = 'image/png';
let app: FastifyInstance;

before(async () => {
  mock.module('../../config/db.sys', {
    namedExports: {
      sysPrisma: { donVi: { findFirst: async () => ({ id: 'dv-1' }) } },
    },
  });
  mock.module('../../helpers/resolveTenantDb', {
    namedExports: { resolveTenantDb: async () => ({}) },
  });
  mock.module(
    '../../services/client/hrm/du_lieu_ca_nhan/taiLieuDrive.service',
    {
      namedExports: {
        GIOI_HAN_FILE_BYTE: 10 * 1024 * 1024,
        MIME_CHO_PHEP: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/heic',
          'application/pdf',
        ],
        taiFileVe: async () => ({
          noiDung: Buffer.from('<svg onload=alert(1)>'),
          tenFile: 'scan.png',
          mimeType: mimeDrive,
        }),
        dinhKemFile: async () => ({}),
        goFile: async () => ({}),
        luuKetNoiDrive: async () => ({}),
        ngatKetNoiDrive: async () => {},
        trangThaiDrive: async () => ({}),
      },
    },
  );
  const ctrl =
    await import('../../controllers/client/hrm/du_lieu_ca_nhan/taiLieu.controller');
  app = Fastify();
  app.addHook('onRequest', async (req: FastifyRequest) => {
    req.user = { userId: 'u', donViId: 'dv-1', role: 'OWNER', tokenVersion: 0 };
  });
  app.get('/tai-lieu/:id/file/:fileId', ctrl.xemFileTaiLieu);
  await app.ready();
});

const URL_FILE =
  '/tai-lieu/3f1c2a4e-1b2c-4d5e-8f9a-0b1c2d3e4f5a/file/7a8b9c0d-1e2f-4a5b-8c6d-7e8f9a0b1c2d';

test('ảnh/PDF trong danh sách -> xem inline đúng loại', async () => {
  for (const mime of ['image/png', 'application/pdf']) {
    mimeDrive = mime;
    const res = await app.inject({ url: URL_FILE });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.headers['content-type'], mime);
    assert.match(String(res.headers['content-disposition']), /^inline;/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  }
});

test('loại lạ Drive báo về (html, svg) -> tải xuống dạng octet-stream, không hiển thị inline', async () => {
  for (const mime of ['text/html', 'image/svg+xml', 'application/xhtml+xml']) {
    mimeDrive = mime;
    const res = await app.inject({ url: URL_FILE });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.headers['content-type'], 'application/octet-stream', mime);
    assert.match(
      String(res.headers['content-disposition']),
      /^attachment;/,
      mime,
    );
  }
});

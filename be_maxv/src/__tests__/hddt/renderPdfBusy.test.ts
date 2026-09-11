import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';

/**
 * `POST /gdt/render-pdf` khi hàng đợi render đã đầy phải trả 429 kèm thông điệp "bận" — để FE báo
 * người dùng thử lại, thay vì 500 như một sự cố máy chủ.
 *
 * Route/controller THẬT; chỉ thay module `helpers/pdfRenderer` (Chromium) bằng bản luôn báo bận.
 * `mock.module()` phải chạy trước khi nạp route nên route được `import()` động trong `before()`.
 */

class PdfRenderBusyErrorGia extends Error {
  constructor() {
    super('Máy chủ đang bận xuất PDF, vui lòng thử lại sau ít phút.');
    this.name = 'PdfRenderBusyError';
  }
}

let gdtRoutes: (fastify: FastifyInstance) => Promise<void>;

before(async () => {
  mock.module('../../helpers/pdfRenderer', {
    namedExports: {
      PdfRenderBusyError: PdfRenderBusyErrorGia,
      taoHangDoiRender: () => async () => {
        throw new PdfRenderBusyErrorGia();
      },
      renderPdfFromHtml: async () => {
        throw new PdfRenderBusyErrorGia();
      },
    },
  });
  ({ default: gdtRoutes } = await import('../../routes/hddt/gdt.route'));
});

test('POST /gdt/render-pdf: hàng đợi đầy -> 429 + thông điệp bận', async () => {
  const app = Fastify();
  app.decorate('authenticate', async (req: FastifyRequest) => {
    req.user = {
      userId: 'user-1',
      donViId: 'dv-1',
      role: 'OWNER',
      tokenVersion: 0,
    };
  });
  await app.register(gdtRoutes);

  const res = await app.inject({
    method: 'POST',
    url: '/render-pdf',
    payload: { html: '<p>Hóa đơn</p>' },
  });

  assert.equal(res.statusCode, 429);
  assert.equal(
    res.json().message,
    'Máy chủ đang bận xuất PDF, vui lòng thử lại sau ít phút.',
  );
  await app.close();
});

import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';

/**
 * vbsec 2026-09-10 (LOW, gdt-etax-gnt.service.ts:367): log `[DEBUG-GNT]` in nguyên body đã gửi và các đoạn
 * HTML quanh `dse_*` — tức `dse_sessionId`/`dse_processorId` SỐNG của phiên eTax (ai đọc được log là chiếm
 * được phiên cổng thuế của doanh nghiệp), cùng vé SSO. Sửa: che các giá trị đó trước khi ghi log.
 */

const BI_MAT = [
  'SESSION-SECRET-DA-GUI',
  'SESSION-SECRET-TRONG-HTML',
  'PROCESSOR-SECRET',
  'VE-SSO-SECRET',
];
const fetchGoc = globalThis.fetch;
let gnt: typeof import('../../services/client/dich_vu_cong/giay_nop_tien/gdt-etax-gnt.service');
let html: typeof import('../../services/client/dich_vu_cong/giay_nop_tien/etaxGntHtml');

before(async () => {
  mock.module('../../services/client/hddt/gdtPacer', {
    namedExports: {
      schedule: (_k: string, _l: string, fn: () => Promise<Response>) => fn(),
      reportOk: () => {},
      reportRateLimited: () => {},
    },
  });
  mock.module('../../services/client/dich_vu_cong/gdt-dvc.service', {
    namedExports: { xinVeSsoDichVuKhac: async () => '' },
  });
  // Trang lỗi của cổng: còn `dse_sessionId`/`dse_processorId` nhưng thiếu `dse_pageId` -> không bóc được
  // trạng thái -> nhánh log chẩn đoán.
  globalThis.fetch = (async () =>
    new Response(
      '<form><input type="hidden" name="dse_sessionId" value="SESSION-SECRET-TRONG-HTML">' +
        '<input value="PROCESSOR-SECRET" type="hidden" name="dse_processorId"></form>',
    )) as typeof fetch;
  gnt =
    await import('../../services/client/dich_vu_cong/giay_nop_tien/gdt-etax-gnt.service');
  html =
    await import('../../services/client/dich_vu_cong/giay_nop_tien/etaxGntHtml');
});

after(() => {
  globalThis.fetch = fetchGoc;
});

test('cheBiMatGnt: che phiên dse_* (body form, input ẩn 2 thứ tự thuộc tính) và vé SSO; giữ phần còn lại', () => {
  const vao = [
    'dse_sessionId=SESSION-SECRET-DA-GUI&dse_applicationId=-1&dse_processorId=PROCESSOR-SECRET&pn=1',
    '<input type="hidden" name="dse_sessionId" value="SESSION-SECRET-TRONG-HTML">',
    '<input value="PROCESSOR-SECRET" type="hidden" name="dse_processorId">',
    'https://thuedientu.gdt.gov.vn/etaxnnt/?vnconnect=SSOTHUE&ticket=VE-SSO-SECRET',
  ].join('\n');
  const ra = html.cheBiMatGnt(vao);
  for (const s of BI_MAT) assert.ok(!ra.includes(s), `còn lộ ${s}`);
  assert.match(ra, /dse_applicationId=-1/);
  assert.match(ra, /pn=1/);
  assert.match(ra, /name="dse_sessionId"/);
  assert.match(ra, /vnconnect=SSOTHUE/);
});

test('bước pipeline hỏng: log chẩn đoán không chứa phiên eTax đang sống', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const phien = {
    donViId: 'dv-1',
    cookies: new Map<string, string>(),
    dse: {
      sessionId: 'SESSION-SECRET-DA-GUI',
      processorId: 'PROCESSOR-SECRET',
      processorState: 'initial',
      pageId: '1',
      operationName: '',
      nextEventName: '',
    },
    referer: 'https://thuedientu.gdt.gov.vn/etaxnnt/Request',
  };

  await assert.rejects(
    gnt.khoiTaoTraCuuGnt(phien),
    gnt.EtaxGntBuocPipelineThatBaiError,
  );
  const daGhi = warn.mock.calls.map((c) => c.arguments.join(' ')).join('\n');
  assert.match(daGhi, /\[DEBUG-GNT\]/);
  for (const s of BI_MAT) assert.ok(!daGhi.includes(s), `log còn lộ ${s}`);
});

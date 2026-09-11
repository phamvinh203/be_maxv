import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';

/**
 * vbsec 2026-09-10 (LOW, gdt-etax-gnt.service.ts:202): chuỗi redirect SSO sang eTax GNT đi theo `Location`
 * / `window.location.href` tới BẤT KỲ địa chỉ nào (kể cả http, IP nội bộ) và gửi kèm TOÀN BỘ cookie phiên.
 * Một response giả/bị chèn ở giữa chuỗi là đủ lái máy chủ gọi vào mạng nội bộ (SSRF) và làm lộ cookie cổng
 * thuế. Sửa: mọi bước phải là https + host thuộc `gdt.gov.vn`.
 *
 * Gọi mạng thay bằng `fetch` giả (ghi lại URL); pacer chạy thẳng; vé SSO lấy từ bản giả của DVC.
 */

const TICKET =
  'https://thuedientu.gdt.gov.vn/etaxnnt/?vnconnect=SSOTHUE&ticket=abc';
const daGoi: string[] = [];
let traLoi: (url: string) => Response;
const fetchGoc = globalThis.fetch;
let gnt: typeof import('../../services/client/dich_vu_cong/giay_nop_tien/gdt-etax-gnt.service');

before(async () => {
  mock.module('../../services/client/hddt/gdtPacer', {
    namedExports: {
      schedule: (_k: string, _l: string, fn: () => Promise<Response>) => fn(),
      reportOk: () => {},
      reportRateLimited: () => {},
    },
  });
  mock.module('../../services/client/dich_vu_cong/gdt-dvc.service', {
    namedExports: {
      xinVeSsoDichVuKhac: async () => JSON.stringify({ url: TICKET }),
    },
  });
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    daGoi.push(url);
    return traLoi(url);
  }) as typeof fetch;
  gnt =
    await import('../../services/client/dich_vu_cong/giay_nop_tien/gdt-etax-gnt.service');
});

after(() => {
  globalThis.fetch = fetchGoc;
});

beforeEach(() => {
  daGoi.length = 0;
});

const PHIEN = { key: 'k', donViId: 'dv-1' };
const chuyenToi = (location: string) =>
  new Response(null, { status: 302, headers: { location } });

test('redirect HTTP sang địa chỉ nội bộ / http -> dừng, không gọi tới đó', async () => {
  for (const dich of [
    'http://169.254.169.254/latest/meta-data/',
    'http://thuedientu.gdt.gov.vn/etaxnnt/x',
    'https://127.0.0.1:8443/admin',
  ]) {
    daGoi.length = 0;
    traLoi = (url) =>
      url === TICKET ? chuyenToi(dich) : new Response('trang lạ');
    await assert.rejects(gnt.ganPhienGnt(PHIEN, 'dv-1'));
    assert.deepEqual(daGoi, [TICKET], `không được gọi ${dich}`);
  }
});

test('JS redirect (window.location.href) sang host ngoài gdt.gov.vn -> dừng, không gọi tới đó', async () => {
  traLoi = (url) =>
    url === TICKET
      ? new Response(
          `<script>window.location.href = 'https://gdt.gov.vn.evil.example/lay-cookie';</script>`,
        )
      : new Response('trang lạ');
  await assert.rejects(gnt.ganPhienGnt(PHIEN, 'dv-1'));
  assert.deepEqual(daGoi, [TICKET]);
});

test('redirect trong cổng thuế (đường dẫn tương đối / host *.gdt.gov.vn qua https) vẫn đi theo bình thường', async () => {
  traLoi = (url) => {
    if (url === TICKET)
      return chuyenToi('/etaxnnt/Request?dse_operationName=corpJumpProc');
    if (url.startsWith('https://thuedientu.gdt.gov.vn/etaxnnt/Request'))
      return chuyenToi('https://dichvucong.gdt.gov.vn/tthc/x');
    return new Response('<html>hạ cánh</html>');
  };
  await assert.rejects(
    gnt.ganPhienGnt(PHIEN, 'dv-1'),
    gnt.EtaxGntKhongLayDuocVeSsoError,
  );
  assert.deepEqual(daGoi, [
    TICKET,
    'https://thuedientu.gdt.gov.vn/etaxnnt/Request?dse_operationName=corpJumpProc',
    'https://dichvucong.gdt.gov.vn/tthc/x',
  ]);
});

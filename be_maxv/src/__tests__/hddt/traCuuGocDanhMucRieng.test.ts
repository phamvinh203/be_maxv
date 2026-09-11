import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';

/**
 * vbsec 2026-09-10 (LOW, easy_invoice.ts:459): `GET /gdt/tra-cuu-goc/nha-cung-cap` trả `urlDaDo` = MỌI MST
 * người bán mà BẤT KỲ công ty nào trên máy chủ đã tải hóa đơn gốc EasyInvoice -> công ty A đọc được công ty
 * B mua hàng của ai. Sửa: `urlDaDo` chỉ gồm người bán mà CHÍNH công ty đang hỏi đã tải.
 *
 * Bộ tải EasyInvoice thay bằng bản giả (map domain đã dò có sẵn, không gọi mạng); dispatcher THẬT.
 */

const EASY = '0105987432';
const NB_CUA_A = '0100000001';
const NB_CUA_B = '0100000002';

let tra: typeof import('../../services/client/hddt/traCuuGoc');

before(async () => {
  mock.module('../../services/client/hddt/traCuuGoc/easy_invoice', {
    namedExports: {
      EASY_INVOICE_MST: EASY,
      easyInvoice: {
        mst: EASY,
        ten: 'EasyInvoice',
        canSellerMst: true,
        urlTraCuu: 'https://{mst}hd.easyinvoice.com.vn/Search/Index',
        urlTraCuuTheoMst: () => ({
          [NB_CUA_A]: `https://${NB_CUA_A}hd.easyinvoice.vn/Search/Index`,
          [NB_CUA_B]: `https://${NB_CUA_B}hd.easyinvoice.vn/Search/Index`,
        }),
        download: async () => ({
          buffer: Buffer.from('%PDF'),
          contentType: 'application/pdf',
          filename: 'a.pdf',
        }),
      },
    },
  });
  tra = await import('../../services/client/hddt/traCuuGoc');
});

test('urlDaDo chỉ gồm người bán mà CHÍNH công ty đang hỏi đã tải — không lộ người bán của công ty khác', async () => {
  assert.deepEqual(tra.danhMucTraCuuGoc('dv-a').urlDaDo, {});

  await tra.taiHoaDonGoc(
    EASY,
    { code: 'ma-tra-cuu', sellerMst: NB_CUA_A },
    'dv-a',
  );
  await tra.taiHoaDonGoc(
    EASY,
    { code: 'ma-tra-cuu', sellerMst: NB_CUA_B },
    'dv-b',
  );

  assert.deepEqual(tra.danhMucTraCuuGoc('dv-a').urlDaDo, {
    [NB_CUA_A]: `https://${NB_CUA_A}hd.easyinvoice.vn/Search/Index`,
  });
  assert.deepEqual(tra.danhMucTraCuuGoc('dv-b').urlDaDo, {
    [NB_CUA_B]: `https://${NB_CUA_B}hd.easyinvoice.vn/Search/Index`,
  });
  assert.deepEqual(tra.danhMucTraCuuGoc(undefined).urlDaDo, {});
  // Danh mục NCC (phần công khai) vẫn đủ cho mọi người.
  assert.ok(tra.danhMucTraCuuGoc('dv-c').nccs.some((n) => n.msttcgp === EASY));
});

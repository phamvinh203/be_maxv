import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../generated/tenant';
import { Prisma } from '../../generated/tenant';
import { BanDaChotError } from '../../services/client/to_khai/application/toKhaiGtgt01.service';
import { capNhatQuyetDinh } from '../../services/client/to_khai/application/keKhaiKy.service';

/**
 * vbsec 2026-09-10 (LOW):
 *  - keKhaiKy.service.ts:392 — `PATCH /to-khai/hoa-don/:chieu/:id` sửa quyết định kê khai (kê khai /
 *    không kê khai, chỉ tiêu tăng giảm) của hóa đơn thuộc kỳ ĐÃ CHỐT — mọi đường ghi khác đều chặn. Bảng kê
 *    của kỳ đã nộp đổi mà số tờ khai giữ nguyên.
 *  - toKhaiGtgt01.controller.ts:28 (+ keKhaiKy.controller.ts) — trả `err.message` thô của MỌI lỗi (lỗi
 *    Prisma kèm tên bảng/đoạn code) ở mã 400.
 */

type Ky = { nam: number; ky_loai: string; ky_so: number };

function taoDbGia(dong: Ky | null, trangThaiKy: 'nhap' | 'chot' | null) {
  const daSua: unknown[] = [];
  const tx = {
    tokhai_ky_hoa_don: {
      findUnique: async () => dong,
      update: async (args: unknown) => {
        daSua.push(args);
        return {};
      },
    },
    $queryRaw: async () => (trangThaiKy ? [{ trang_thai: trangThaiKy }] : []),
  };
  const db = {
    ...tx,
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  } as unknown as PrismaClient;
  return { db, daSua };
}

const KY_Q1: Ky = { nam: 2026, ky_loai: 'quy', ky_so: 1 };

test('hóa đơn thuộc kỳ ĐÃ CHỐT -> từ chối sửa quyết định, không ghi gì', async () => {
  const { db, daSua } = taoDbGia(KY_Q1, 'chot');

  await assert.rejects(
    capNhatQuyetDinh(db, 'hd-1', 'sold', { keKhai: false }),
    BanDaChotError,
  );
  assert.equal(daSua.length, 0);
});

test('kỳ còn nháp (hoặc chưa lập tờ khai) -> sửa bình thường', async () => {
  for (const trangThai of ['nhap', null] as const) {
    const { db, daSua } = taoDbGia(KY_Q1, trangThai);
    await capNhatQuyetDinh(db, 'hd-1', 'sold', { keKhai: false });
    assert.equal(daSua.length, 1);
  }
});

test('hóa đơn chưa gán kỳ -> báo lỗi nghiệp vụ dễ hiểu (không phải lỗi Prisma)', async () => {
  const { db, daSua } = taoDbGia(null, null);

  await assert.rejects(
    capNhatQuyetDinh(db, 'hd-1', 'sold', { keKhai: false }),
    /chưa được gán vào kỳ/,
  );
  assert.equal(daSua.length, 0);
});

/* ---------- controller: không lộ lỗi nội bộ ---------- */

let app: FastifyInstance;

before(async () => {
  const loiPrisma = new Prisma.PrismaClientKnownRequestError(
    'Invalid `prisma.tokhai_gtgt01.findUnique()` invocation in C:\\be_maxv\\src\\services\\x.ts:12:3',
    { code: 'P2021', clientVersion: '7.8.0' },
  );
  mock.module('../../helpers/resolveTenantDb', {
    namedExports: {
      resolveTenantDb: async () => ({
        tokhai_gtgt01: {
          findUnique: async () => {
            throw loiPrisma;
          },
          findMany: async () => {
            throw loiPrisma;
          },
        },
      }),
      resolveTenantDbName: async () => 'db_x',
      resolveTenantInfo: async () => ({ dbName: 'db_x', maSoThue: '0100000000', xemLuong: true }),
    },
  });
  const { doc, danhSach } = await import(
    '../../controllers/client/to_khai/toKhaiGtgt01.controller'
  );
  app = Fastify();
  app.get('/gtgt01/danh-sach', danhSach);
  app.get('/gtgt01/:nam/:kyLoai/:kySo', doc);
  await app.ready();
});

test('lỗi Prisma ở controller tờ khai -> thông điệp chung, không lộ tên bảng / đường dẫn file', async () => {
  for (const url of ['/gtgt01/danh-sach', '/gtgt01/2026/quy/1']) {
    const res = await app.inject({ method: 'GET', url });
    assert.equal(res.statusCode, 400, url);
    assert.ok(!/prisma|tokhai_gtgt01|\.ts/i.test(res.body), `${url} lộ lỗi nội bộ: ${res.body}`);
  }
});

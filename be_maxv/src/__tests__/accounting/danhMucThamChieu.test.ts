import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { env } from '../../config/env';
import { tenantDbName, tenantUrl } from '../../utils/dbName';
import {
  dayTenantSchema,
  dropTenant,
} from '../../services/shared/provisioning.service';
import { applyTenantConstraints } from '../../services/shared/hrmTenantConstraints';
import { getTenantDb } from '../../helpers/tenantClient';
import { BadRequestError, ConflictError } from '../../helpers/errors';
import { hoaDonBodySchema } from '../../validators/accounting/banHang/hoaDonBanHang.validator';
import { createHoaDon } from '../../services/client/accounting/banHang/chung_tu/hoaDonBanHang.service';
import {
  deleteHangHoa,
  doiMaHangHoa,
} from '../../services/client/accounting/tonKho/danh_muc/hangHoa.service';
import { deleteKhachHang } from '../../services/client/accounting/banHang/danh_muc/khachHang.service';
import { deleteKho } from '../../services/client/accounting/tonKho/danh_muc/kho.service';
import { batBuocDbKiemThu } from '../_hoTro/dbKiemThu';

/**
 * Xóa / đổi mã danh mục khi chứng từ bán hàng đang tham chiếu tới (vbsec 2026-09-10, LOW
 * hangHoa.service.ts:254): kiểm "đếm tham chiếu rồi xóa" bỏ sót dòng hóa đơn (d81 / m81), không có khóa
 * ngoại -> xóa hàng hóa / khách hàng / kho đang dùng để lại chứng từ mồ côi; đổi mã hàng không kéo theo
 * dòng hóa đơn.
 *
 * Postgres THẬT, hai DB tenant riêng: 9960000057 (sạch), 9960000058 (sẵn dòng hóa đơn mồ côi). DROP sau.
 */

const DB = tenantDbName('9960000057');
const DB_CU = tenantDbName('9960000058');
const db = () => getTenantDb(DB);

async function voiAdmin<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: env.adminUrl });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function sql(dbName: string, cau: string, thamSo: unknown[] = []) {
  const c = new Client({ connectionString: tenantUrl(dbName) });
  await c.connect();
  try {
    return (await c.query(cau, thamSo)).rows;
  } finally {
    await c.end();
  }
}

async function taoDb(dbName: string) {
  await dropTenant(dbName);
  await voiAdmin((c) => c.query(`CREATE DATABASE "${dbName}"`));
  await dayTenantSchema(dbName);
}

const hoaDon = (so_ct: string, ma_kh: string, ma_vt: string) =>
  hoaDonBodySchema.parse({ so_ct, ma_kh, chi_tiet: [{ ma_vt, so_luong: 1, gia_nt2: 1000 }] });

before(async () => {
  batBuocDbKiemThu();
  await taoDb(DB);
  await taoDb(DB_CU);
  await db().dmkh.createMany({
    data: [
      { ma_kh: 'KH01', ten_kh: 'Khách có hóa đơn' },
      { ma_kh: 'KH02', ten_kh: 'Khách chưa có gì' },
    ],
  });
  await db().dmkho.create({ data: { ma_kho: 'K01', ten_kho: 'Kho chính' } });
  await db().dmvt.createMany({
    data: [
      { ma_vt: 'VT01', ten_vt: 'Hàng có hóa đơn', dvt: 'Cái' },
      { ma_vt: 'VT02', ten_vt: 'Hàng chưa dùng', dvt: 'Cái' },
      { ma_vt: 'VT03', ten_vt: 'Hàng sẽ đổi mã', dvt: 'Cái' },
    ],
  });
  await createHoaDon(db(), hoaDon('DM-1', 'KH01', 'VT01'), 'user-1');
  await createHoaDon(db(), hoaDon('DM-2', 'KH01', 'VT03'), 'user-1');
  await db().d81.updateMany({ where: { ma_vt: 'VT01' }, data: { ma_kho: 'K01' } });

  // Dữ liệu cũ đã mồ côi từ trước (hàng bị xóa khi chưa có khóa).
  await sql(DB_CU, `INSERT INTO m81 (stt_rec, so_ct, ma_kh) VALUES ('CU1', '1', 'KH-DA-XOA')`);
  await sql(
    DB_CU,
    `INSERT INTO d81 (stt_rec0, stt_rec, line_nbr, ma_vt) VALUES ('CU1-1', 'CU1', 1, 'VT-DA-XOA')`,
  );
});

after(async () => {
  await dropTenant(DB);
  await dropTenant(DB_CU);
});

test('xóa hàng hóa đang có trên dòng hóa đơn -> 409, hàng vẫn còn; hàng chưa dùng xóa được', async () => {
  await assert.rejects(deleteHangHoa(db(), 'VT01'), ConflictError);
  assert.ok(await db().dmvt.findUnique({ where: { ma_vt: 'VT01' } }));
  await deleteHangHoa(db(), 'VT02');
});

test('xóa khách hàng đang có hóa đơn -> 409; khách chưa có gì xóa được', async () => {
  await assert.rejects(deleteKhachHang(db(), 'KH01'), ConflictError);
  await deleteKhachHang(db(), 'KH02');
});

test('xóa kho đang có trên dòng hóa đơn -> 409', async () => {
  await assert.rejects(deleteKho(db(), 'K01'), ConflictError);
});

test('đổi mã hàng kéo theo dòng hóa đơn (không để dòng mồ côi mã cũ)', async () => {
  await doiMaHangHoa(db(), { ma_cu: 'VT03', ma_moi: 'VT03-MOI' } as never);

  assert.equal(await db().d81.count({ where: { ma_vt: 'VT03' } }), 0);
  assert.equal(await db().d81.count({ where: { ma_vt: 'VT03-MOI' } }), 1);
});

test('lập hóa đơn với mã hàng / mã khách KHÔNG có trong danh mục -> 400 nói rõ mã nào', async () => {
  await assert.rejects(createHoaDon(db(), hoaDon('DM-3', 'KH01', 'VT-LA'), 'user-1'), (e: unknown) =>
    e instanceof BadRequestError && e.message.includes('VT-LA'),
  );
  await assert.rejects(createHoaDon(db(), hoaDon('DM-4', 'KH-LA', 'VT01'), 'user-1'), (e: unknown) =>
    e instanceof BadRequestError && e.message.includes('KH-LA'),
  );
});

test('sau khi áp ràng buộc: chính DB chặn xóa hàng/khách đang được chứng từ tham chiếu (không còn khe race)', async () => {
  const kq = await applyTenantConstraints(DB);
  assert.deepEqual(kq.vuongDuLieu, []);

  await assert.rejects(sql(DB, `DELETE FROM dmvt WHERE ma_vt = 'VT01'`), { code: '23503' });
  await assert.rejects(sql(DB, `DELETE FROM dmkh WHERE ma_kh = 'KH01'`), { code: '23503' });
  // Đổi mã ở tầng DB cũng kéo theo dòng hóa đơn.
  await sql(DB, `UPDATE dmvt SET ma_vt = 'VT01-B' WHERE ma_vt = 'VT01'`);
  assert.equal((await sql(DB, `SELECT count(*)::int AS n FROM d81 WHERE ma_vt = 'VT01-B'`))[0].n, 1);
});

test('tenant đang có chứng từ mồ côi: vẫn áp được ràng buộc (NOT VALID), không xóa dòng cũ nào', async () => {
  const kq = await applyTenantConstraints(DB_CU);

  assert.deepEqual(kq.vuongDuLieu, []);
  assert.equal((await sql(DB_CU, `SELECT count(*)::int AS n FROM d81`))[0].n, 1);
  // Dòng MỚI thì không được mồ côi.
  await assert.rejects(
    sql(DB_CU, `INSERT INTO d81 (stt_rec0, stt_rec, line_nbr, ma_vt) VALUES ('CU1-2', 'CU1', 2, 'VT-KHONG-CO')`),
    { code: '23503' },
  );
});

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { env } from '../../config/env';
import { tenantDbName, tenantUrl } from '../../utils/dbName';
import {
  dayTenantSchema,
  dropTenant,
} from '../../services/shared/provisioning.service';
import {
  applyTenantConstraints,
  raSoatTenant,
} from '../../services/shared/hrmTenantConstraints';
import { batBuocDbKiemThu } from '../_hoTro/dbKiemThu';

/**
 * Ràng buộc DUY NHẤT (đơn vị cơ sở, số chứng từ) trên `m81` ở tầng CSDL tenant.
 *
 * vbsec 2026-09-10 (MEDIUM, hoaDonBanHang.service.ts:141): khóa advisory ở tầng ứng dụng đã chặn hai lượt
 * lưu song song; đây là lớp phòng thủ thứ hai ở DB. Không khai `@@unique` trong schema.prisma: tenant đang
 * có số trùng thì `db push` vỡ TOÀN BỘ. Áp bằng `applyTenantConstraints` (sau mỗi lần push) — tenant còn
 * dữ liệu trùng thì báo "vướng dữ liệu" và bỏ qua, KHÔNG xóa dòng nào.
 *
 * Postgres THẬT: hai DB tenant riêng — MST 9960000054 (sạch), 9960000055 (sẵn số trùng). DROP sau.
 */

const DB_SACH = tenantDbName('9960000054');
const DB_BAN = tenantDbName('9960000055');
const TEN_RANG_BUOC = 'unique m81(ma_dvcs, so_ct)';

async function voiAdmin<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: env.adminUrl });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function voiTenant<T>(
  db: string,
  fn: (c: Client) => Promise<T>,
): Promise<T> {
  const c = new Client({ connectionString: tenantUrl(db) });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

const themHoaDon = (
  c: Client,
  stt: string,
  soCt: string,
  maDvcs: string | null,
) =>
  c.query(
    `INSERT INTO m81 (stt_rec, so_ct, ma_kh, ma_dvcs) VALUES ($1, $2, 'KH01', $3)`,
    [stt, soCt, maDvcs],
  );

async function taoDbTenant(db: string) {
  await dropTenant(db);
  await voiAdmin((c) => c.query(`CREATE DATABASE "${db}"`));
  await dayTenantSchema(db);
  // Khóa ngoại m81.ma_kh -> dmkh (cùng lượt áp ràng buộc) đòi mã khách có trong danh mục.
  await voiTenant(db, (c) =>
    c.query(`INSERT INTO dmkh (ma_kh, ten_kh) VALUES ('KH01', 'Khách test')`),
  );
}

before(async () => {
  batBuocDbKiemThu();
  await taoDbTenant(DB_SACH);
  await taoDbTenant(DB_BAN);
  // Dữ liệu cũ đã trùng số từ trước khi có khóa.
  await voiTenant(DB_BAN, async (c) => {
    await themHoaDon(c, 'CU1', '0001', null);
    await themHoaDon(c, 'CU2', '0001', null);
  });
});

after(async () => {
  await dropTenant(DB_SACH);
  await dropTenant(DB_BAN);
});

test('tenant sạch: sau khi áp ràng buộc, DB từ chối hai hóa đơn cùng (đơn vị cơ sở, số chứng từ)', async () => {
  const kq = await applyTenantConstraints(DB_SACH);
  assert.ok(kq.daAp.includes(TEN_RANG_BUOC), JSON.stringify(kq));

  await voiTenant(DB_SACH, async (c) => {
    await themHoaDon(c, 'A1', '0100', 'CN1');
    await assert.rejects(themHoaDon(c, 'A2', '0100', 'CN1'), { code: '23505' });
    // Khác đơn vị cơ sở thì được.
    await themHoaDon(c, 'A3', '0100', 'CN2');
  });
});

test('không có đơn vị cơ sở (NULL) cũng bị chặn trùng', async () => {
  await voiTenant(DB_SACH, async (c) => {
    await themHoaDon(c, 'B1', '0200', null);
    await assert.rejects(themHoaDon(c, 'B2', '0200', null), { code: '23505' });
  });
});

test('áp lại lần hai không lỗi (idempotent)', async () => {
  const kq = await applyTenantConstraints(DB_SACH);
  assert.deepEqual(kq.vuongDuLieu, []);
});

test('tenant đang có số trùng: báo "vướng dữ liệu", KHÔNG xóa dòng nào, các ràng buộc khác vẫn áp', async () => {
  const kq = await applyTenantConstraints(DB_BAN);

  assert.ok(
    kq.vuongDuLieu.some((v) => v.ten === TEN_RANG_BUOC),
    JSON.stringify(kq),
  );
  assert.ok(kq.daAp.length > 0);
  const soDong = await voiTenant(DB_BAN, async (c) =>
    Number(
      (await c.query(`SELECT count(*) FROM m81 WHERE so_ct = '0001'`)).rows[0]
        .count,
    ),
  );
  assert.equal(soDong, 2);
});

test('rà soát (chỉ đọc) liệt kê được số chứng từ trùng để dọn tay', async () => {
  const kq = await raSoatTenant(DB_BAN);
  const muc = kq.theoMuc.find((m) => m.ma === 'so-ct-trung');
  assert.ok(muc, 'thiếu mục rà soát số chứng từ trùng');
  assert.equal(muc.soDong, 1);
});

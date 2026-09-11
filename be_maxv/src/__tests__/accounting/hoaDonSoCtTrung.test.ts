import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { env } from '../../config/env';
import { tenantDbName } from '../../utils/dbName';
import {
  dayTenantSchema,
  dropTenant,
} from '../../services/shared/provisioning.service';
import { getTenantDb } from '../../helpers/tenantClient';
import { ConflictError } from '../../helpers/errors';
import { hoaDonBodySchema } from '../../validators/accounting/banHang/hoaDonBanHang.validator';
import {
  createHoaDon,
  updateHoaDon,
} from '../../services/client/accounting/banHang/chung_tu/hoaDonBanHang.service';
import { batBuocDbKiemThu } from '../_hoTro/dbKiemThu';

/**
 * Trùng số chứng từ hóa đơn bán hàng khi hai người lưu CÙNG LÚC (hoaDonBanHang.service.ts:141).
 *
 * vbsec 2026-09-10 (MEDIUM): `so_ct` chỉ kiểm trùng bằng đọc-rồi-ghi NGOÀI transaction, `m81` không có
 * unique `(ma_dvcs, so_ct)` -> hai lượt lưu song song cùng qua bước kiểm rồi cùng ghi, ra hai hóa đơn
 * trùng số.
 *
 * Chạy trên Postgres THẬT (khe chen giữa là thứ đang kiểm — DB giả không tái hiện được khóa). DB tenant
 * riêng của test: MST 9960000051, tạo + đẩy schema trước, DROP sau.
 */

const DB = tenantDbName('9960000051');
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

before(async () => {
  batBuocDbKiemThu();
  await dropTenant(DB);
  await voiAdmin((c) => c.query(`CREATE DATABASE "${DB}"`));
  await dayTenantSchema(DB);
  // Mã khách phải có trong danh mục (hoaDonBanHang.service.ts `kiemMaDanhMuc`).
  await db().dmkh.create({ data: { ma_kh: 'KH01', ten_kh: 'Khách test' } });
});

after(async () => {
  await dropTenant(DB);
});

const hoaDon = (so_ct: string, ma_dvcs?: string) =>
  hoaDonBodySchema.parse({ so_ct, ma_kh: 'KH01', ma_dvcs });

const SONG_SONG = 6;

async function demSoCt(so_ct: string) {
  return db().m81.count({ where: { so_ct } });
}

test(`${SONG_SONG} lượt tạo cùng số chứng từ chạy song song -> chỉ 1 hóa đơn, các lượt còn lại 409`, async () => {
  const ketQua = await Promise.allSettled(
    Array.from({ length: SONG_SONG }, () =>
      createHoaDon(db(), hoaDon('RACE-TAO'), 'user-1'),
    ),
  );

  assert.equal(await demSoCt('RACE-TAO'), 1);
  const biTuChoi = ketQua.filter((k) => k.status === 'rejected');
  assert.equal(biTuChoi.length, SONG_SONG - 1);
  for (const k of biTuChoi)
    assert.ok((k as PromiseRejectedResult).reason instanceof ConflictError);
});

test('đổi số của nhiều hóa đơn sang CÙNG một số, song song -> chỉ 1 lượt thành công', async () => {
  const ids = [];
  for (let i = 0; i < SONG_SONG; i++) {
    ids.push(
      (await createHoaDon(db(), hoaDon(`RACE-SUA-GOC-${i}`), 'user-1')).stt_rec,
    );
  }

  await Promise.allSettled(
    ids.map((id) => updateHoaDon(db(), id, hoaDon('RACE-SUA'), 'user-1')),
  );

  assert.equal(await demSoCt('RACE-SUA'), 1);
});

test('cùng số nhưng khác đơn vị cơ sở vẫn tạo được song song (khóa theo cặp ma_dvcs + so_ct)', async () => {
  await Promise.all([
    createHoaDon(db(), hoaDon('RACE-DVCS', 'CN1'), 'user-1'),
    createHoaDon(db(), hoaDon('RACE-DVCS', 'CN2'), 'user-1'),
  ]);

  assert.equal(await demSoCt('RACE-DVCS'), 2);
});

test('hóa đơn KHÔNG có đơn vị cơ sở cũng bị chặn trùng (NULL không lọt qua)', async () => {
  await Promise.allSettled(
    Array.from({ length: SONG_SONG }, () =>
      createHoaDon(db(), hoaDon('RACE-NULL'), 'user-1'),
    ),
  );

  assert.equal(
    await db().m81.count({ where: { so_ct: 'RACE-NULL', ma_dvcs: null } }),
    1,
  );
});

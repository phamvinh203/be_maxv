import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { env } from '../../config/env';
import { sysPrisma } from '../../config/db.sys';
import { tenantDbName, tenantSlug } from '../../utils/dbName';
import { batBuocDbKiemThu } from '../_hoTro/dbKiemThu';

/**
 * DB tenant "mồ côi" và việc provisioning NHẬN LUÔN DB có sẵn (provisioning.service.ts:75).
 *
 * vbsec 2026-09-10 (MEDIUM): `createDatabaseIfNotExists` lặng lẽ dùng lại DB đã tồn tại. Vài đường xóa
 * để lại DB vật lý còn dữ liệu (công ty FAILED chưa có dbName; owner bị xóa kéo theo tài khoản con
 * đã được nâng OWNER mà vẫn giữ ownerId). Owner mới đăng ký lại cùng MST (MST là công khai) -> thừa hưởng
 * trọn hóa đơn, bảng lương của công ty cũ.
 *
 * Chạy trên Postgres THẬT (CREATE/DROP DATABASE là thứ đang kiểm). Chỉ thay `writeLog`. Dữ liệu test:
 * MST 99600000 41..45, email `vbsec.mocoi.*@test.local` — dọn trước và sau.
 */

const MST = {
  dangKyMoi: '9960000041',
  failedChuaDbName: '9960000042',
  cuaTaiKhoanCon: '9960000043',
  capLai: '9960000044',
};
const EMAIL = {
  owner: 'vbsec.mocoi.owner@test.local',
  con: 'vbsec.mocoi.con@test.local',
  admin: 'vbsec.mocoi.admin@test.local',
};

let provisionTenant: typeof import('../../services/shared/provisioning.service').provisionTenant;
let destroyCompany: typeof import('../../services/client/company.service').destroyCompany;
let adminDeleteUser: typeof import('../../services/admin/adminUser.service').adminDeleteUser;
let adminChangeUserRole: typeof import('../../services/admin/adminUser.service').adminChangeUserRole;

async function voiAdmin<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: env.adminUrl });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

const dbTonTai = (ten: string) =>
  voiAdmin(async (c) => ((await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [ten])).rowCount ?? 0) > 0);

/** DB có sẵn, chứa 1 bảng dữ liệu cũ — mô phỏng DB mồ côi của công ty trước. */
async function taoDbCoDuLieuCu(ten: string) {
  await voiAdmin((c) => c.query(`CREATE DATABASE "${ten}"`));
  const c = new Client({ connectionString: `${env.tenantBaseUrl}/${ten}` });
  await c.connect();
  try {
    await c.query('CREATE TABLE du_lieu_cu (bi_mat text)');
    await c.query(`INSERT INTO du_lieu_cu VALUES ('bang luong cong ty cu')`);
  } finally {
    await c.end();
  }
}

async function soBangTrongDb(ten: string): Promise<number> {
  const c = new Client({ connectionString: `${env.tenantBaseUrl}/${ten}` });
  await c.connect();
  try {
    const r = await c.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`);
    return r.rows[0].n;
  } finally {
    await c.end();
  }
}

async function cleanup() {
  await sysPrisma.user.deleteMany({ where: { email: { in: [EMAIL.con] } } });
  await sysPrisma.user.deleteMany({ where: { email: { in: Object.values(EMAIL) } } });
  await sysPrisma.donVi.deleteMany({ where: { maSoThue: { in: Object.values(MST) } } });
  for (const mst of Object.values(MST)) {
    await voiAdmin((c) => c.query(`DROP DATABASE IF EXISTS "${tenantDbName(mst)}" WITH (FORCE)`));
  }
}

async function taoUser(email: string, role: 'OWNER' | 'OWNER_EMPLOYEE' | 'ADMIN', ownerId: string | null = null) {
  return sysPrisma.user.create({
    data: { email, hoTen: email, password: 'x', role, status: 'ACTIVE', isActive: true, ownerId },
  });
}

async function taoDonVi(ownerId: string, mst: string, status: 'FAILED' | 'READY' | 'PROVISIONING', dbName: string | null) {
  return sysPrisma.donVi.create({
    data: { ownerId, maSoThue: mst, slug: tenantSlug(mst), tenDonVi: `Cty ${mst}`, status, dbName },
  });
}

before(async () => {
  batBuocDbKiemThu();
  mock.module('../../services/shared/syslog.service', {
    namedExports: { writeLog: async () => {} },
  });
  ({ provisionTenant } = await import('../../services/shared/provisioning.service'));
  ({ destroyCompany } = await import('../../services/client/company.service'));
  ({ adminDeleteUser, adminChangeUserRole } = await import('../../services/admin/adminUser.service'));
});

beforeEach(cleanup);

after(async () => {
  await cleanup();
  await sysPrisma.$disconnect();
});

test('đăng ký mới gặp DB MST đã tồn tại -> TỪ CHỐI, không nhận DB cũ (dữ liệu cũ không bị ai thừa hưởng)', async () => {
  const ten = tenantDbName(MST.dangKyMoi);
  await taoDbCoDuLieuCu(ten);
  const owner = await taoUser(EMAIL.owner, 'OWNER');
  const dv = await taoDonVi(owner.id, MST.dangKyMoi, 'PROVISIONING', null);

  await assert.rejects(provisionTenant(dv.id, MST.dangKyMoi));

  const sau = await sysPrisma.donVi.findUniqueOrThrow({ where: { id: dv.id } });
  assert.equal(sau.status, 'FAILED');
  assert.equal(sau.dbName, null, 'không gắn DB cũ vào công ty mới');
  assert.equal(await soBangTrongDb(ten), 1, 'DB cũ giữ nguyên, không bị push schema chồng lên');
});

test('admin chủ động cấp lại DB (cho phép DB có sẵn) vẫn chạy được', async () => {
  const ten = tenantDbName(MST.capLai);
  await voiAdmin((c) => c.query(`CREATE DATABASE "${ten}"`));
  const owner = await taoUser(EMAIL.owner, 'OWNER');
  const dv = await taoDonVi(owner.id, MST.capLai, 'PROVISIONING', null);

  assert.equal(await provisionTenant(dv.id, MST.capLai, { choPhepDbCoSan: true }), ten);
  assert.equal((await sysPrisma.donVi.findUniqueOrThrow({ where: { id: dv.id } })).status, 'READY');
});

test('owner xóa công ty FAILED (chưa có dbName) -> DB vật lý cũng bị DROP, không thành mồ côi', async () => {
  const ten = tenantDbName(MST.failedChuaDbName);
  await taoDbCoDuLieuCu(ten);
  const owner = await taoUser(EMAIL.owner, 'OWNER');
  const dv = await taoDonVi(owner.id, MST.failedChuaDbName, 'FAILED', null);

  await destroyCompany(dv.id, owner.id, MST.failedChuaDbName);

  assert.equal(await dbTonTai(ten), false);
});

test('nâng nhân viên lên OWNER -> bỏ ownerId (không còn bị xóa dây chuyền theo owner cũ)', async () => {
  const admin = await taoUser(EMAIL.admin, 'ADMIN');
  const owner = await taoUser(EMAIL.owner, 'OWNER');
  const con = await taoUser(EMAIL.con, 'OWNER_EMPLOYEE', owner.id);

  await adminChangeUserRole(con.id, 'OWNER', admin.id);

  assert.equal((await sysPrisma.user.findUniqueOrThrow({ where: { id: con.id } })).ownerId, null);
});

test('xóa owner -> DROP cả DB của công ty do tài khoản con (bị xóa dây chuyền) sở hữu', async () => {
  const ten = tenantDbName(MST.cuaTaiKhoanCon);
  await taoDbCoDuLieuCu(ten);
  const admin = await taoUser(EMAIL.admin, 'ADMIN');
  const owner = await taoUser(EMAIL.owner, 'OWNER');
  // Dữ liệu cũ: tài khoản con từng được nâng OWNER mà vẫn giữ ownerId, rồi tự tạo công ty.
  const con = await taoUser(EMAIL.con, 'OWNER', owner.id);
  await taoDonVi(con.id, MST.cuaTaiKhoanCon, 'READY', ten);

  await adminDeleteUser(owner.id, EMAIL.owner, admin.id);

  assert.equal(await dbTonTai(ten), false, 'DB của công ty bị xóa dây chuyền phải bị DROP');
});

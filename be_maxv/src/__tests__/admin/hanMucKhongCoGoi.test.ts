import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sysPrisma } from '../../config/db.sys';
import { ForbiddenError } from '../../helpers/errors';
import { tenantSlug } from '../../utils/dbName';
import { batBuocDbKiemThu } from '../_hoTro/dbKiemThu';

/**
 * Hạn mức MST / nhân viên khi owner KHÔNG có thuê bao (limits.service.ts).
 *
 * vbsec 2026-09-10 (phần treo từ lỗi CAO [7]): `getPlanLimits` coi "không có thuê bao" là KHÔNG GIỚI HẠN.
 * Owner mất gói (tạo gói dùng thử lỗi lúc đăng ký, admin xóa thuê bao) tạo MST — mỗi MST là một DB tenant
 * — và mời nhân viên vô hạn. Sửa: không có gói = chặn. Tài khoản CHƯA có công ty nào vẫn được cấp gói dùng
 * thử (lưới an toàn cũ) nhưng TRƯỚC bước kiểm trần.
 *
 * Control plane THẬT; chỉ thay `provisionTenant` (CREATE DATABASE) và `writeLog`. Dữ liệu test: email
 * `vbsec.khonggoi.*@test.local`, MST 99600000 71..73, gói VBSEC_KHONGGOI_PLAN — dọn trước và sau.
 */

const EMAIL = {
  moi: 'vbsec.khonggoi.moi@test.local',
  cu: 'vbsec.khonggoi.cu@test.local',
  voHan: 'vbsec.khonggoi.vohan@test.local',
};
const MST = {
  congTyCu: '9960000071',
  dauTien: '9960000072',
  themMoi: '9960000073',
};
const PLAN_MA = 'VBSEC_KHONGGOI_PLAN';

let registerCompany: typeof import('../../services/client/company.service').registerCompany;
let assertMstLimit: typeof import('../../services/shared/limits.service').assertMstLimit;
let assertUserLimit: typeof import('../../services/shared/limits.service').assertUserLimit;
const id: Record<keyof typeof EMAIL, string> = { moi: '', cu: '', voHan: '' };

async function cleanup() {
  const users = await sysPrisma.user.findMany({
    where: { email: { in: Object.values(EMAIL) } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await sysPrisma.donVi.deleteMany({
    where: { maSoThue: { in: Object.values(MST) } },
  });
  await sysPrisma.subscriptionHistory.deleteMany({
    where: { ownerId: { in: ids } },
  });
  await sysPrisma.subscription.deleteMany({ where: { ownerId: { in: ids } } });
  await sysPrisma.user.deleteMany({ where: { id: { in: ids } } });
  await sysPrisma.subscriptionPlan.deleteMany({ where: { ma: PLAN_MA } });
}

const taoOwner = (email: string) =>
  sysPrisma.user.create({
    data: {
      email,
      hoTen: email,
      password: 'x',
      role: 'OWNER',
      status: 'ACTIVE',
      isActive: true,
    },
  });

const dangKy = (ownerId: string, maSoThue: string) =>
  registerCompany({
    ownerId,
    tenCongTy: `Cty ${maSoThue}`,
    maSoThue,
    diaChi: 'Hà Nội',
    sdt: '0900000000',
  });

before(async () => {
  batBuocDbKiemThu();
  mock.module('../../services/shared/provisioning.service', {
    namedExports: {
      provisionTenant: async (_donViId: string, maSoThue: string) =>
        `test_${maSoThue}`,
      dropTenant: async () => {},
    },
  });
  mock.module('../../services/shared/syslog.service', {
    namedExports: { writeLog: async () => {} },
  });
  ({ registerCompany } = await import('../../services/client/company.service'));
  ({ assertMstLimit, assertUserLimit } =
    await import('../../services/shared/limits.service'));

  await cleanup();
  id.moi = (await taoOwner(EMAIL.moi)).id;
  id.cu = (await taoOwner(EMAIL.cu)).id;
  id.voHan = (await taoOwner(EMAIL.voHan)).id;

  // Owner cũ: đã có công ty nhưng KHÔNG có thuê bao.
  await sysPrisma.donVi.create({
    data: {
      ownerId: id.cu,
      maSoThue: MST.congTyCu,
      slug: tenantSlug(MST.congTyCu),
      tenDonVi: 'Cty cũ',
      status: 'READY',
    },
  });
  // Gói KHÔNG GIỚI HẠN thật sự (trần null) — khác hẳn "không có gói".
  const goi = await sysPrisma.subscriptionPlan.create({
    data: { ma: PLAN_MA, ten: 'Gói test vô hạn', gia: 0, chuKyThang: 1 },
  });
  await sysPrisma.subscription.create({
    data: { ownerId: id.voHan, planId: goi.id, status: 'ACTIVE' },
  });
});

after(async () => {
  await cleanup();
  await sysPrisma.$disconnect();
});

test('owner KHÔNG có thuê bao -> kiểm trần MST và nhân viên đều CHẶN (không còn "không gói = vô hạn")', async () => {
  await assert.rejects(assertMstLimit(id.cu, 1), ForbiddenError);
  await assert.rejects(assertUserLimit(id.cu, 0), ForbiddenError);
});

test('owner cũ đã có công ty mà không có gói tạo thêm công ty -> 403, không tạo công ty nào', async () => {
  await assert.rejects(dangKy(id.cu, MST.themMoi), ForbiddenError);
  assert.equal(await sysPrisma.donVi.count({ where: { ownerId: id.cu } }), 1);
});

test('tài khoản CHƯA có công ty nào: được cấp gói dùng thử TRƯỚC khi kiểm trần -> tạo công ty đầu tiên được', async () => {
  const cty = await dangKy(id.moi, MST.dauTien);

  assert.equal(cty.maSoThue, MST.dauTien);
  assert.ok(
    await sysPrisma.subscription.findUnique({ where: { ownerId: id.moi } }),
  );
});

test('gói không giới hạn THẬT (trần null) vẫn không giới hạn', async () => {
  await assertMstLimit(id.voHan, 1000);
  await assertUserLimit(id.voHan, 1000);
});

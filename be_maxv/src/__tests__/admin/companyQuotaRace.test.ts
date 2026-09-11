import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sysPrisma } from '../../config/db.sys';
import { ConflictError, ForbiddenError } from '../../helpers/errors';
import { batBuocDbKiemThu } from '../_hoTro/dbKiemThu';

/**
 * Trần số MST theo gói (`soMstToiDa`) khi owner tạo công ty — `registerCompany` (company.service.ts).
 *
 * Lỗ hổng vbsec 2026-09-10 [7]: đếm MST -> kiểm trần -> tạo `don_vi` là 3 bước rời, không khóa. Owner
 * gói dùng thử bắn nhiều request song song: tất cả cùng đọc số đếm cũ, cùng qua kiểm tra, cùng tạo
 * công ty + cấp DB tenant -> vượt gói và vắt kiệt server Postgres dùng chung.
 *
 * Chạy trên control plane THẬT (transaction + lock của Postgres mới là thứ đang được kiểm), chỉ thay
 * `provisionTenant` (CREATE DATABASE + `prisma db push` — nặng, không liên quan tới trần gói) và
 * `writeLog`. Dữ liệu test: email `@test.local`, MST 99600000xx, gói VBSEC_QUOTA_PLAN — dọn trước và sau.
 */

const OWNER_EMAIL = 'vbsec.quota.owner@test.local';
const PLAN_MA = 'VBSEC_QUOTA_PLAN';
const MSTS = [
  '9960000001',
  '9960000002',
  '9960000003',
  '9960000004',
  '9960000005',
];

let registerCompany: typeof import('../../services/client/company.service').registerCompany;
let ownerId = '';
let soLanCapDbTenant = 0;

async function cleanup() {
  // Xóa user cascade don_vi + subscription; gói xóa sau cùng.
  await sysPrisma.user.deleteMany({ where: { email: OWNER_EMAIL } });
  await sysPrisma.donVi.deleteMany({ where: { maSoThue: { in: MSTS } } });
  await sysPrisma.subscriptionPlan.deleteMany({ where: { ma: PLAN_MA } });
}

before(async () => {
  batBuocDbKiemThu();
  mock.module('../../services/shared/provisioning.service', {
    namedExports: {
      provisionTenant: async (_donViId: string, maSoThue: string) => {
        soLanCapDbTenant += 1;
        return `test_${maSoThue}`;
      },
      dropTenant: async () => {},
    },
  });
  mock.module('../../services/shared/syslog.service', {
    namedExports: { writeLog: async () => {} },
  });
  ({ registerCompany } = await import('../../services/client/company.service'));

  await cleanup();
  const owner = await sysPrisma.user.create({
    data: {
      email: OWNER_EMAIL,
      hoTen: 'Owner quota',
      password: 'khong-dang-nhap-duoc',
      role: 'OWNER',
      status: 'ACTIVE',
      isActive: true,
    },
  });
  ownerId = owner.id;
  const plan = await sysPrisma.subscriptionPlan.create({
    data: {
      ma: PLAN_MA,
      ten: 'Gói test 1 MST',
      gia: 0,
      chuKyThang: 1,
      soMstToiDa: 1,
      soNguoiToiDa: 1,
    },
  });
  await sysPrisma.subscription.create({
    data: { ownerId, planId: plan.id, status: 'ACTIVE' },
  });
});

after(async () => {
  await cleanup();
  await sysPrisma.$disconnect();
});

test('gói tối đa 1 MST: 5 request tạo công ty SONG SONG -> đúng 1 thành công, 4 bị chặn 403, chỉ cấp 1 DB', async () => {
  const ketQua = await Promise.allSettled(
    MSTS.map((maSoThue) =>
      registerCompany({
        ownerId,
        tenCongTy: `Cty ${maSoThue}`,
        maSoThue,
        diaChi: 'Hà Nội',
        sdt: '0900000000',
      }),
    ),
  );

  const thanhCong = ketQua.filter((k) => k.status === 'fulfilled');
  const biChan = ketQua.filter(
    (k): k is PromiseRejectedResult => k.status === 'rejected',
  );

  assert.equal(thanhCong.length, 1, 'chỉ 1 request được tạo công ty');
  assert.equal(biChan.length, 4);
  assert.ok(
    biChan.every((k) => k.reason instanceof ForbiddenError),
    'các request còn lại bị chặn vì vượt trần gói',
  );
  assert.equal(await sysPrisma.donVi.count({ where: { ownerId } }), 1);
  assert.equal(soLanCapDbTenant, 1, 'chỉ cấp đúng 1 DB tenant');
});

test('đăng ký MST đã có chủ -> 409 kèm email ĐÃ CHE, không lộ email đầy đủ của chủ tài khoản', async () => {
  // vbsec 2026-09-10 (MEDIUM, company.service.ts:46): trả nguyên email chủ MST -> ai tự đăng ký cũng
  // tra được MST công khai ra email khách hàng MAXV (danh sách để lừa đảo / dò mật khẩu).
  const daCo = await sysPrisma.donVi.findFirstOrThrow({ where: { ownerId } });

  const loi = await registerCompany({
    ownerId,
    tenCongTy: 'Cty trùng',
    maSoThue: daCo.maSoThue,
    diaChi: 'Hà Nội',
    sdt: '0900000000',
  }).then(
    () => assert.fail('phải bị chặn vì MST đã có chủ'),
    (e: unknown) => e,
  );

  assert.ok(loi instanceof ConflictError);
  assert.ok(!loi.message.includes(OWNER_EMAIL), `lộ email đầy đủ: ${loi.message}`);
  assert.ok(loi.message.includes('vb***@t***.local'), `thiếu gợi ý email đã che: ${loi.message}`);
});

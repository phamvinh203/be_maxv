import { test, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sysPrisma } from '../../config/db.sys';
import { ConflictError, ForbiddenError } from '../../helpers/errors';
import { tenantSlug } from '../../utils/dbName';
import { batBuocDbKiemThu } from '../_hoTro/dbKiemThu';

/**
 * Trần số nhân viên theo gói (`soNguoiToiDa`) qua luồng mời (owner) -> duyệt (admin).
 *
 * vbsec 2026-09-10 (MEDIUM, adminInvite.service.ts:74 + company.service.ts:262):
 *  - Lúc mời chỉ đếm nhân viên ĐÃ duyệt, bỏ qua lời mời đang chờ -> owner gói 1 ghế nộp 20 lời mời,
 *    admin duyệt hết = 20 nhân viên.
 *  - Lúc duyệt KHÔNG kiểm lại trần (kể cả khi gói đã hạ cấp giữa chừng).
 *  - Duyệt/từ chối cập nhật trạng thái không điều kiện: từ chối chen giữa lúc đang duyệt vẫn để lại
 *    tài khoản đã tạo + mật khẩu đã gửi.
 *
 * Chạy trên control plane THẬT (transaction + lock Postgres là thứ đang kiểm); chỉ thay gửi mail và
 * `writeLog`. Dữ liệu test: email `vbsec.seat.*@test.local`, MST 9960000011, gói VBSEC_SEAT_PLAN.
 */

const OWNER_EMAIL = 'vbsec.seat.owner@test.local';
const ADMIN_EMAIL = 'vbsec.seat.admin@test.local';
const NV = (i: number) => `vbsec.seat.nv${i}@test.local`;
const MST = '9960000011';
const PLAN_MA = 'VBSEC_SEAT_PLAN';

let inviteUserToCompany: typeof import('../../services/client/company.service').inviteUserToCompany;
let adminApproveInvite: typeof import('../../services/admin/adminInvite.service').adminApproveInvite;
let adminRejectInvite: typeof import('../../services/admin/adminInvite.service').adminRejectInvite;

let ownerId = '';
let adminId = '';
let donViId = '';
const mailDaGui: Array<{ to: string; subject: string; text: string }> = [];

const TAT_CA_EMAIL = [OWNER_EMAIL, ADMIN_EMAIL, NV(1), NV(2), NV(3), NV(4)];

async function cleanup() {
  // Nhân viên (ownerId -> owner, cascade) + owner (cascade don_vi, invite, subscription) + admin; gói sau cùng.
  await sysPrisma.user.deleteMany({ where: { email: { in: TAT_CA_EMAIL }, role: 'OWNER_EMPLOYEE' } });
  await sysPrisma.user.deleteMany({ where: { email: { in: TAT_CA_EMAIL } } });
  await sysPrisma.donVi.deleteMany({ where: { maSoThue: MST } });
  await sysPrisma.subscriptionPlan.deleteMany({ where: { ma: PLAN_MA } });
}

before(async () => {
  batBuocDbKiemThu();
  mock.module('../../services/shared/mailer.service', {
    namedExports: {
      sendMail: async (m: { to: string; subject: string; text: string }) => {
        mailDaGui.push(m);
      },
    },
  });
  mock.module('../../services/shared/syslog.service', {
    namedExports: { writeLog: async () => {} },
  });
  ({ inviteUserToCompany } = await import('../../services/client/company.service'));
  ({ adminApproveInvite, adminRejectInvite } = await import('../../services/admin/adminInvite.service'));
});

beforeEach(async () => {
  await cleanup();
  const owner = await sysPrisma.user.create({
    data: { email: OWNER_EMAIL, hoTen: 'Owner ghế', password: 'x', role: 'OWNER', status: 'ACTIVE', isActive: true },
  });
  ownerId = owner.id;
  const admin = await sysPrisma.user.create({
    data: { email: ADMIN_EMAIL, hoTen: 'Admin', password: 'x', role: 'ADMIN', status: 'ACTIVE', isActive: true },
  });
  adminId = admin.id;
  const dv = await sysPrisma.donVi.create({
    data: { ownerId, maSoThue: MST, slug: tenantSlug(MST), tenDonVi: 'Cty ghế', status: 'READY', dbName: `test_${MST}` },
  });
  donViId = dv.id;
  const plan = await sysPrisma.subscriptionPlan.create({
    data: { ma: PLAN_MA, ten: 'Gói 1 nhân viên', gia: 0, chuKyThang: 1, soMstToiDa: 1, soNguoiToiDa: 1 },
  });
  await sysPrisma.subscription.create({ data: { ownerId, planId: plan.id, status: 'ACTIVE' } });
});

after(async () => {
  await cleanup();
  await sysPrisma.$disconnect();
});

function moi(email: string) {
  return inviteUserToCompany({
    ownerId,
    requestedById: ownerId,
    email,
    hoTen: 'Nhân viên',
    chucVu: 'Kế toán',
    donViIds: [donViId],
  });
}

/** Lời mời PENDING tạo thẳng trong DB — mô phỏng lời mời đã có từ trước (hoặc gói hạ cấp sau khi mời). */
async function loiMoiCoSan(email: string) {
  return sysPrisma.inviteRequest.create({
    data: { ownerId, email, hoTen: 'Nhân viên', chucVu: 'Kế toán', donViIds: [donViId], requestedById: ownerId },
  });
}

test('lời mời ĐANG CHỜ tính vào trần: gói 1 nhân viên -> mời người thứ 2 bị chặn', async () => {
  await moi(NV(1));
  await assert.rejects(moi(NV(2)), ForbiddenError);
});

test('3 lời mời SONG SONG, gói 1 nhân viên -> chỉ 1 lời mời được tạo', async () => {
  const kq = await Promise.allSettled([moi(NV(1)), moi(NV(2)), moi(NV(3))]);
  assert.equal(kq.filter((k) => k.status === 'fulfilled').length, 1);
  assert.equal(await sysPrisma.inviteRequest.count({ where: { ownerId } }), 1);
});

test('duyệt kiểm lại trần: 2 lời mời có sẵn, gói 1 nhân viên -> chỉ duyệt được 1', async () => {
  const a = await loiMoiCoSan(NV(1));
  const b = await loiMoiCoSan(NV(2));

  await adminApproveInvite(a.id, adminId);
  await assert.rejects(adminApproveInvite(b.id, adminId), ForbiddenError);

  assert.equal(await sysPrisma.user.count({ where: { ownerId } }), 1);
  const bSau = await sysPrisma.inviteRequest.findUnique({ where: { id: b.id } });
  assert.equal(bSau?.status, 'PENDING', 'lời mời bị chặn vẫn chờ (admin nâng gói rồi duyệt lại được)');
});

/**
 * vbsec 2026-09-10 (LOW, mailTemplates.ts:80): duyệt lời mời gửi MẬT KHẨU DẠNG RÕ qua email (nằm vĩnh viễn
 * trong hộp thư, bị chuyển tiếp/đọc trộm là mất tài khoản), không bắt đổi. Sửa: tài khoản tạo với mật khẩu
 * không ai biết; email chỉ báo đã duyệt + hướng dẫn tự đặt mật khẩu bằng "Quên mật khẩu" (OTP).
 */
test('duyệt lời mời: email KHÔNG chứa mật khẩu, hướng dẫn tự đặt qua "Quên mật khẩu"', async () => {
  mailDaGui.length = 0;
  const loiMoi = await loiMoiCoSan(NV(3));
  await adminApproveInvite(loiMoi.id, adminId);

  assert.equal(mailDaGui.length, 1);
  const mail = mailDaGui[0]!;
  assert.equal(mail.to, NV(3));
  assert.doesNotMatch(mail.text, /Mật khẩu\s*:/i);
  assert.match(mail.text, /Quên mật khẩu/);
  const user = await sysPrisma.user.findUnique({ where: { email: NV(3) } });
  assert.ok(user?.password?.startsWith('$2'), 'mật khẩu vẫn lưu dạng băm');
});

test('từ chối chen giữa lúc đang duyệt -> không để lại tài khoản đã tạo', async () => {
  const loiMoi = await loiMoiCoSan(NV(4));

  const [duyet, tuChoi] = await Promise.allSettled([
    adminApproveInvite(loiMoi.id, adminId),
    adminRejectInvite(loiMoi.id, adminId, { lyDoTuChoi: 'Sai người' }),
  ]);

  assert.equal(tuChoi.status, 'fulfilled', 'từ chối (nhanh hơn — duyệt còn băm mật khẩu) thành công');
  assert.equal(duyet.status, 'rejected');
  assert.ok((duyet as PromiseRejectedResult).reason instanceof ConflictError);
  assert.equal(await sysPrisma.user.count({ where: { email: NV(4) } }), 0);
  const sau = await sysPrisma.inviteRequest.findUnique({ where: { id: loiMoi.id } });
  assert.equal(sau?.status, 'REJECTED');
});

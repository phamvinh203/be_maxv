import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sysPrisma } from '../../config/db.sys';
import { addMonths } from '../../services/shared/subscription.service';
import { batBuocDbKiemThu } from '../_hoTro/dbKiemThu';

/**
 * vbsec 2026-09-10 (LOW, adminSubscription.service.ts:294): renew / change-plan / cancel đọc thuê bao
 * NGOÀI transaction rồi ghi giá trị tuyệt đối -> hai lượt gia hạn song song cùng đọc một `ketThuc`, mất
 * một kỳ đã trả tiền nhưng vẫn ghi HAI dòng lịch sử; hủy chạy song song gia hạn có thể bị hồi sinh ACTIVE.
 *
 * Control plane THẬT (khóa dòng của Postgres là thứ đang kiểm). Chỉ thay `writeLog`. Dữ liệu test: email
 * `vbsec.thuebao@test.local`, gói VBSEC_TB_PLAN — dọn trước và sau.
 */

const EMAIL = 'vbsec.thuebao@test.local';
const PLAN_MA = 'VBSEC_TB_PLAN';
const HAN_BAN_DAU = new Date(Date.now() + 10 * 24 * 3600 * 1000);

let adminRenewSubscription: typeof import('../../services/admin/adminSubscription.service').adminRenewSubscription;
let adminCancelSubscription: typeof import('../../services/admin/adminSubscription.service').adminCancelSubscription;
let subId = '';

async function cleanup() {
  const u = await sysPrisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (u) {
    await sysPrisma.subscriptionHistory.deleteMany({ where: { ownerId: u.id } });
    await sysPrisma.subscription.deleteMany({ where: { ownerId: u.id } });
    await sysPrisma.user.delete({ where: { id: u.id } });
  }
  await sysPrisma.subscriptionPlan.deleteMany({ where: { ma: PLAN_MA } });
}

before(async () => {
  batBuocDbKiemThu();
  mock.module('../../services/shared/syslog.service', {
    namedExports: { writeLog: async () => {} },
  });
  ({ adminRenewSubscription, adminCancelSubscription } = await import(
    '../../services/admin/adminSubscription.service'
  ));
  await cleanup();
  const owner = await sysPrisma.user.create({
    data: { email: EMAIL, hoTen: 'tb', password: 'x', role: 'OWNER', status: 'ACTIVE', isActive: true },
  });
  const plan = await sysPrisma.subscriptionPlan.create({
    data: { ma: PLAN_MA, ten: 'Gói test 1 tháng', gia: 100, chuKyThang: 1 },
  });
  subId = (
    await sysPrisma.subscription.create({
      data: { ownerId: owner.id, planId: plan.id, status: 'ACTIVE', ketThuc: HAN_BAN_DAU },
    })
  ).id;
});

beforeEach(async () => {
  await sysPrisma.subscriptionHistory.deleteMany({ where: { subscriptionId: subId } });
  await sysPrisma.subscription.update({
    where: { id: subId },
    data: { status: 'ACTIVE', ketThuc: HAN_BAN_DAU },
  });
});

after(async () => {
  await cleanup();
  await sysPrisma.$disconnect();
});

test('hai lượt gia hạn song song -> cộng ĐỦ 2 kỳ, khớp 2 dòng lịch sử (không mất kỳ đã trả tiền)', async () => {
  await Promise.all([
    adminRenewSubscription(subId, 'admin-1'),
    adminRenewSubscription(subId, 'admin-1'),
  ]);

  const sub = await sysPrisma.subscription.findUniqueOrThrow({ where: { id: subId } });
  assert.equal(sub.ketThuc?.getTime(), addMonths(addMonths(HAN_BAN_DAU, 1), 1).getTime());
  assert.equal(await sysPrisma.subscriptionHistory.count({ where: { subscriptionId: subId } }), 2);
});

test('hủy và gia hạn chạy song song -> không bao giờ kết thúc ở trạng thái hồi sinh ACTIVE sau khi hủy', async () => {
  const kq = await Promise.allSettled([
    adminCancelSubscription(subId, 'admin-1'),
    adminRenewSubscription(subId, 'admin-1'),
  ]);

  const sub = await sysPrisma.subscription.findUniqueOrThrow({ where: { id: subId } });
  const huyThanhCong = kq[0].status === 'fulfilled';
  assert.ok(huyThanhCong);
  assert.equal(sub.status, 'CANCELED');
});

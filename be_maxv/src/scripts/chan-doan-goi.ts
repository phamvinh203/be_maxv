import { sysPrisma } from '../config/db.sys';
import { MODULE_KEYS } from '../constants/modules';
import { goiConHieuLuc } from '../services/shared/modules.service';

/**
 * CHẨN ĐOÁN: vì sao tài khoản cũ không thấy module nào.
 *
 *   npx tsx src/scripts/chan-doan-goi.ts
 *
 * CHỈ ĐỌC — không ghi, không sửa gì. Chạy đúng `goiConHieuLuc` mà API dùng thật, nên kết luận
 * ở đây đúng bằng cái người dùng đang thấy trên màn hình, không phải suy đoán từ cột `status`.
 */

const bayGio = new Date();

function ngay(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '(không hạn)';
}

async function main(): Promise<void> {
  console.log(`Thời điểm chạy: ${bayGio.toISOString()}\n`);

  // ---- 1) Owner KHÔNG có thuê bao nào ----
  const owner = await sysPrisma.user.findMany({
    where: { role: 'OWNER' },
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  const subs = await sysPrisma.subscription.findMany({
    select: {
      ownerId: true,
      status: true,
      batDau: true,
      ketThuc: true,
      plan: { select: { ma: true, ten: true, chuKyThang: true, features: true } },
    },
  });
  const theoOwner = new Map(subs.map((s) => [s.ownerId, s]));

  const khongCoSub = owner.filter((u) => !theoOwner.has(u.id));
  console.log(`===== 1) OWNER KHÔNG CÓ THUÊ BAO: ${khongCoSub.length}/${owner.length} =====`);
  for (const u of khongCoSub) console.log(`  ${u.email}  (đăng ký ${ngay(u.createdAt)})`);
  if (khongCoSub.length === 0) console.log('  (không có)');

  // ---- 2) Thuê bao đã quá hạn nhưng status vẫn xanh ----
  console.log('\n===== 2) THUÊ BAO HẾT HIỆU LỰC (theo đúng goiConHieuLuc) =====');
  const hong: string[] = [];
  const ok: string[] = [];
  for (const u of owner) {
    const s = theoOwner.get(u.id);
    if (!s) continue;
    const conHieuLuc = goiConHieuLuc(s, bayGio);
    const dong = `  ${u.email.padEnd(32)} gói=${(s.plan.ma ?? '?').padEnd(8)} status=${String(s.status).padEnd(9)} ketThuc=${ngay(s.ketThuc)}`;
    (conHieuLuc ? ok : hong).push(dong);
  }
  console.log(`-- HẾT hiệu lực (${hong.length}) — đây là nhóm mất sạch module:`);
  console.log(hong.length ? hong.join('\n') : '  (không có)');
  console.log(`-- CÒN hiệu lực (${ok.length}):`);
  console.log(ok.length ? ok.join('\n') : '  (không có)');

  // ---- 3) Toàn cảnh từng gói ----
  console.log('\n===== 3) TỪNG GÓI: cấp module gì, thuê bao còn/hết hạn =====');
  const plans = await sysPrisma.subscriptionPlan.findMany({ orderBy: { ma: 'asc' } });
  for (const p of plans) {
    const cua = subs.filter((s) => s.plan.ma === p.ma);
    const vinhVien = cua.filter((s) => s.ketThuc === null).length;
    const conHan = cua.filter((s) => s.ketThuc !== null && s.ketThuc >= bayGio).length;
    const hetHan = cua.filter((s) => s.ketThuc !== null && s.ketThuc < bayGio).length;
    const f = (p.features ?? {}) as Record<string, unknown>;
    const batTat = MODULE_KEYS.map((k) => `${k}=${f[k] === true ? 'BẬT' : 'tắt'}`).join(' ');
    console.log(
      `  ${p.ma.padEnd(8)} chuKyThang=${String(p.chuKyThang).padEnd(3)} [${batTat}]  ` +
        `thuê bao: ${cua.length} (vĩnh viễn ${vinhVien} / còn hạn ${conHan} / HẾT HẠN ${hetHan})`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sysPrisma.$disconnect());

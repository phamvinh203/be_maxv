import { sysPrisma } from '../../config/db.sys';
import { tenantSlug } from '../../utils/dbName';
import { provisionTenant } from '../shared/provisioning.service';
import { createTrialSubscription } from '../shared/subscription.service';
import { writeLog } from '../shared/syslog.service';
import { ConflictError, NotFoundError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type { RegisterCompanyInput } from '../../validators/auth.validator';

/**
 * BƯỚC 2 — Đăng ký công ty cho một người dùng đã có tài khoản.
 * Tạo don_vi + cấp DB riêng maxv2_<mst>_app + gắn user.donViId.
 * (Mỗi user chỉ gắn 1 công ty.)
 */
export async function registerCompany(input: RegisterCompanyInput) {
  const { userId, tenCongTy, maSoThue, diaChi, sdt, loaiHinhKinhDoanh } = input;

  const [user, mstExists] = await Promise.all([
    sysPrisma.user.findUnique({ where: { id: userId } }),
    sysPrisma.donVi.findUnique({ where: { maSoThue } }),
  ]);

  if (!user) throw new NotFoundError(MESSAGES.COMPANY.USER_NOT_FOUND);
  if (user.donViId) throw new ConflictError(MESSAGES.COMPANY.USER_HAS_COMPANY);
  if (mstExists) throw new ConflictError(MESSAGES.COMPANY.MST_TAKEN);

  // Tạo don_vi (PROVISIONING) + gắn user.donViId trong 1 transaction
  const donVi = await sysPrisma.$transaction(async (tx) => {
    const dv = await tx.donVi.create({
      data: {
        maSoThue,
        slug: tenantSlug(maSoThue),
        tenDonVi: tenCongTy,
        diaChi,
        sdt,
        loaiHinhKinhDoanh,
        status: 'PROVISIONING',
      },
    });
    await tx.user.update({ where: { id: userId }, data: { donViId: dv.id } });
    return dv;
  });

  // Cấp DB riêng (ngoài transaction)
  const dbName = await provisionTenant(donVi.id, maSoThue);

  // Tạo thuê bao dùng thử (best-effort) rồi ghi nhật ký (writeLog tự nuốt lỗi).
  await createTrialSubscription(donVi.id).catch(() => undefined);
  await writeLog({
    hanhDong: 'CREATE_COMPANY',
    userId,
    donViId: donVi.id,
    chiTiet: { maSoThue, dbName },
  });

  return {
    id: donVi.id,
    maSoThue,
    tenDonVi: tenCongTy,
    diaChi,
    sdt,
    loaiHinhKinhDoanh,
    dbName,
  };
}

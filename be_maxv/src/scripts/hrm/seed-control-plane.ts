import { sysPrisma } from '../../config/db.sys';
import { hashPassword, verifyPassword } from '../../utils/password';
import { tenantDbName, tenantSlug } from '../../utils/dbName';
import { provisionTenant, tenantDbExists } from '../../services/shared/provisioning.service';

/**
 * BOOTSTRAP CONTROL-PLANE (maxv2_sys) CHO TENANT SEED DỮ LIỆU MẪU HRM/PAYROLL.
 *
 * Vì sao tách khỏi `prisma/tenant/seed.ts`: tài khoản (`User`), công ty (`DonVi`) và thuê bao
 * (`Subscription`) sống ở DB CONTROL PLANE (`maxv2_sys`), khác hẳn DB tenant (`maxv_<mst>_app`)
 * mà `prisma/tenant/seed.ts` ghi dữ liệu HRM vào. Một Prisma schema/client CHỈ trỏ được một DB
 * tại một thời điểm (`prisma/sys/schema.prisma` vs `prisma/tenant/schema.prisma` là hai schema
 * độc lập) nên việc "tạo tài khoản đăng nhập + gán quyền công ty" KHÔNG thể nằm chung file với
 * việc "seed danh mục/nhân viên/bảng lương của một công ty cụ thể" — đúng đúng ranh giới
 * multi-tenant của kiến trúc (`resolveTenantDb`/`sysPrisma` tách bạch, xem CLAUDE.md).
 *
 * Hàm này ĐƯỢC GỌI TRƯỚC bởi `prisma/tenant/seed.ts`, trả về `dbName` để script kia mở đúng
 * kết nối tenant. Idempotent tuyệt đối: chạy lại nhiều lần không tạo trùng, không ghi đè dữ
 * liệu KHÁC của người dùng thật (chỉ tự sửa khi phát hiện sai lệch so với bộ seed đã định).
 *
 * AN TOÀN: KHÔNG BAO GIỜ tạo mới nếu MST đã thuộc owner KHÁC — dừng và báo lỗi rõ ràng thay vì
 * âm thầm ghi đè (đúng yêu cầu "DỪNG LẠI khi có dữ liệu thật của người khác").
 */

export const SEED_OWNER_EMAIL = 'test1@gmail.com';
export const SEED_OWNER_PASSWORD = '12345abc';
export const SEED_MST = '0111142786';
const SEED_COMPANY_NAME = 'CÔNG TY TNHH ĐẦU TƯ SẢN XUẤT VÀ XNK THÀNH CÔNG';
const SEED_PLAN_MA = 'PRO MAX';

/** Thuê bao gia hạn thêm ngần này khi phát hiện sắp hết hạn (< 30 ngày) — đủ dư để test tay. */
const SUBSCRIPTION_EXTEND_DAYS = 90;
const SUBSCRIPTION_MIN_REMAINING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ControlPlaneSeedResult {
  ownerId: string;
  donViId: string;
  mst: string;
  dbName: string;
}

export async function ensureControlPlaneTestTenant(): Promise<ControlPlaneSeedResult> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Seed dữ liệu mẫu KHÔNG được chạy ở NODE_ENV=production — đây là dev tooling, chỉ chạy trên DB dev/local.',
    );
  }

  // ---------------------------------------------------------------- 1. Tài khoản OWNER
  const correctHash = await hashPassword(SEED_OWNER_PASSWORD);
  let user = await sysPrisma.user.findUnique({ where: { email: SEED_OWNER_EMAIL } });

  if (!user) {
    user = await sysPrisma.user.create({
      data: {
        email: SEED_OWNER_EMAIL,
        hoTen: 'test1',
        password: correctHash,
        role: 'OWNER',
        status: 'ACTIVE',
        isActive: true,
      },
    });
    console.log(`[control-plane] Đã tạo user OWNER mới: ${SEED_OWNER_EMAIL}`);
  } else {
    const matchMatKhau = await verifyPassword(SEED_OWNER_PASSWORD, user.password);
    const canSua: Record<string, unknown> = {};
    if (!matchMatKhau) canSua.password = correctHash;
    if (user.role !== 'OWNER') canSua.role = 'OWNER';
    if (user.status !== 'ACTIVE') canSua.status = 'ACTIVE';
    if (!user.isActive) canSua.isActive = true;

    if (Object.keys(canSua).length > 0) {
      user = await sysPrisma.user.update({ where: { id: user.id }, data: canSua });
      console.log(
        `[control-plane] Tài khoản ${SEED_OWNER_EMAIL} đã tồn tại — đồng bộ lại: ${Object.keys(canSua).join(', ')}.`,
      );
    } else {
      console.log(`[control-plane] Tài khoản ${SEED_OWNER_EMAIL} đã đúng chuẩn (mật khẩu/role/status), giữ nguyên.`);
    }
  }

  // ---------------------------------------------------------------- 2. Công ty (DonVi)
  const dbName = tenantDbName(SEED_MST);
  let donVi = await sysPrisma.donVi.findUnique({ where: { maSoThue: SEED_MST } });

  if (donVi && donVi.ownerId !== user.id) {
    throw new Error(
      `DỪNG LẠI: MST ${SEED_MST} đã tồn tại trong maxv2_sys nhưng thuộc owner KHÁC ` +
        `(ownerId=${donVi.ownerId}, khác owner của ${SEED_OWNER_EMAIL}=${user.id}). ` +
        `Không tự ý ghi đè dữ liệu công ty của người khác — báo lại cho người vận hành để quyết định.`,
    );
  }

  if (!donVi) {
    donVi = await sysPrisma.donVi.create({
      data: {
        ownerId: user.id,
        maSoThue: SEED_MST,
        slug: tenantSlug(SEED_MST),
        tenDonVi: SEED_COMPANY_NAME,
        status: 'PROVISIONING',
      },
    });
    console.log(`[control-plane] Đã tạo don_vi mới cho MST ${SEED_MST}.`);
  } else {
    console.log(`[control-plane] don_vi MST ${SEED_MST} đã tồn tại, đúng owner (${SEED_OWNER_EMAIL}) — giữ nguyên.`);
  }

  const dbTonTai = await tenantDbExists(dbName);
  if (!dbTonTai || donVi.status !== 'READY') {
    await provisionTenant(donVi.id, SEED_MST);
    donVi = await sysPrisma.donVi.findUniqueOrThrow({ where: { id: donVi.id } });
    console.log(`[control-plane] Đã provision (hoặc xác nhận lại) DB tenant "${dbName}".`);
  } else {
    console.log(`[control-plane] DB tenant "${dbName}" đã READY từ trước — không đụng vào.`);
  }

  // ---------------------------------------------------------------- 3. Gói cước có bật module hrm
  let plan = await sysPrisma.subscriptionPlan.findFirst({
    where: { ma: SEED_PLAN_MA },
  });
  if (!plan) {
    plan = await sysPrisma.subscriptionPlan.findFirst({
      where: { features: { path: ['hrm'], equals: true } },
      orderBy: { createdAt: 'asc' },
    });
  }
  if (!plan) {
    plan = await sysPrisma.subscriptionPlan.create({
      data: {
        ma: SEED_PLAN_MA,
        ten: 'PRO MAX (seed dev)',
        gia: 0,
        chuKyThang: 12,
        features: { hrm: true, dvc: true, tokhai: true, accounting: true },
      },
    });
    console.log(`[control-plane] Chưa có gói cước nào bật module hrm — đã tạo gói "${SEED_PLAN_MA}" mới.`);
  }

  const now = new Date();
  const nguongToiThieu = new Date(now.getTime() + SUBSCRIPTION_MIN_REMAINING_DAYS * DAY_MS);
  const hanMoi = new Date(now.getTime() + SUBSCRIPTION_EXTEND_DAYS * DAY_MS);

  let sub = await sysPrisma.subscription.findUnique({ where: { ownerId: user.id } });
  if (!sub) {
    sub = await sysPrisma.subscription.create({
      data: { ownerId: user.id, planId: plan.id, status: 'ACTIVE', batDau: now, ketThuc: hanMoi },
    });
    console.log('[control-plane] Owner chưa có subscription — đã tạo mới, trạng thái ACTIVE.');
  } else {
    const canSua: Record<string, unknown> = {};
    if (sub.status !== 'ACTIVE') canSua.status = 'ACTIVE';
    if (!sub.ketThuc || sub.ketThuc < nguongToiThieu) canSua.ketThuc = hanMoi;
    if (Object.keys(canSua).length > 0) {
      sub = await sysPrisma.subscription.update({ where: { id: sub.id }, data: canSua });
      console.log(
        `[control-plane] Subscription hiện có sắp hết hạn hoặc không ACTIVE — đã gia hạn/kích hoạt lại (hạn mới: ${hanMoi.toISOString().slice(0, 10)}).`,
      );
    } else {
      console.log(`[control-plane] Subscription owner đang ACTIVE, còn hạn tới ${sub.ketThuc?.toISOString().slice(0, 10)} — giữ nguyên.`);
    }
  }

  const finalPlan = await sysPrisma.subscriptionPlan.findUniqueOrThrow({ where: { id: sub.planId } });
  const features = (finalPlan.features ?? {}) as Record<string, unknown>;
  if (features.hrm !== true) {
    console.warn(
      `[control-plane] CẢNH BÁO: gói cước hiện gán cho owner ("${finalPlan.ma}") KHÔNG bật module "hrm". ` +
        `Chuyển subscription sang gói "${SEED_PLAN_MA}" thủ công nếu cần test UI HRM.`,
    );
  }

  return { ownerId: user.id, donViId: donVi.id, mst: SEED_MST, dbName };
}

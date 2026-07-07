import { sysPrisma } from '../../config/db.sys';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../../utils/password';
import { writeLog } from '../shared/syslog.service';
import { createTrialSubscription } from '../shared/subscription.service';
import { listAccessibleCompanies } from '../shared/companyAccess.service';
import { canAccessDonVi } from '../../helpers/access';
import { ConflictError, UnauthorizedError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type {
  RegisterInput,
  LoginInput,
} from '../../validators/auth.validator';

/**
 * BƯỚC 1 — Đăng ký người dùng.
 * Lưu thông tin (hoTen, email, sdt, password) vào maxv2_sys và gán luôn gói
 * dùng thử TRIAL cho tài khoản. CHƯA tạo công ty / DB nào ở bước này.
 */
export async function registerUser(input: RegisterInput) {
  const { hoTen, email, sdt, password } = input;

  // Check email trước; chỉ hash (CPU-bound ~100ms) khi chắc chắn email chưa tồn tại.
  const existing = await sysPrisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError(MESSAGES.AUTH.EMAIL_EXISTS);

  const passwordHash = await hashPassword(password);
  const user = await sysPrisma.user.create({
    data: {
      hoTen,
      email,
      sdt,
      password: passwordHash,
      role: 'OWNER',
      status: 'ACTIVE', // TODO: PENDING + xác thực email
      isActive: true, // TODO: false cho tới khi xác thực email
      // donViId = null: chưa gắn công ty nào
    },
  });

  // Gán gói dùng thử ngay khi tạo tài khoản (best-effort: lỗi tạo gói không được
  // chặn đăng ký — lưới an toàn idempotent ở bước tạo công ty sẽ bù lại nếu thiếu).
  // Log lại thay vì nuốt hoàn toàn: đây là entitlement quan trọng, cần biết nếu tạo lỗi.
  await createTrialSubscription(user.id).catch((err) =>
    console.error(
      `[registerUser] createTrialSubscription lỗi cho owner ${user.id}:`,
      err,
    ),
  );

  await writeLog({ hanhDong: 'REGISTER', userId: user.id, chiTiet: { email } });

  return { id: user.id, hoTen, email, sdt: user.sdt };
}

/**
 * Đăng nhập: xác thực email + mật khẩu, trả về user + danh sách công ty được phép.
 *
 * Token KHÔNG gắn sẵn công ty (donViId=null) — trừ khi user chỉ có đúng 1 công ty
 * thì tự chọn luôn để đỡ 1 lần switch. Nhiều công ty -> FE gọi /companies/:id/switch.
 * Việc ký token do controller làm (cần reply.jwtSign).
 */
export async function loginUser(input: LoginInput) {
  const { email, password } = input;

  const user = await sysPrisma.user.findUnique({ where: { email } });

  // Luôn so sánh 1 lần bcrypt (kể cả user không tồn tại) -> thời gian không đổi.
  const ok = await verifyPassword(password, user?.password ?? DUMMY_HASH);
  if (!user || !ok) {
    throw new UnauthorizedError(MESSAGES.AUTH.INVALID_CREDENTIALS);
  }
  if (!user.isActive) {
    throw new UnauthorizedError(MESSAGES.AUTH.ACCOUNT_INACTIVE);
  }

  const companies = await listAccessibleCompanies(user.id, user.role);
  // Mặc định vào MST đầu tiên (token nhúng luôn donViId) — FE đổi MST qua switch sau.
  const activeDonViId = companies[0]?.id ?? null;

  await writeLog({
    hanhDong: 'LOGIN',
    userId: user.id,
    donViId: activeDonViId ?? undefined,
  });

  return {
    user: {
      id: user.id,
      hoTen: user.hoTen,
      email: user.email,
      role: user.role,
    },
    companies,
    activeDonViId,
  };
}

/**
 * Tải lại user theo id để cấp access token mới (refresh).
 * Đọc lại role từ DB (không tin payload cũ) và giữ lại công ty đang chọn từ refresh
 * token — nhưng chỉ khi user VẪN còn quyền vào công ty đó (quyền có thể đã bị thu hồi).
 */
export async function loadUserForRefresh(
  userId: string,
  tokenDonViId: string | null,
) {
  const user = await sysPrisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError(MESSAGES.AUTH.REFRESH_INVALID);
  }

  let donViId: string | null = null;
  if (
    tokenDonViId &&
    (await canAccessDonVi(user.id, user.role, tokenDonViId))
  ) {
    donViId = tokenDonViId;
  }

  return { id: user.id, role: user.role, donViId };
}

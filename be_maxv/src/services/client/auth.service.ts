import { sysPrisma } from '../../config/db.sys';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../../utils/password';
import { writeLog } from '../shared/syslog.service';
import { ConflictError, UnauthorizedError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type { RegisterInput, LoginInput } from '../../validators/auth.validator';

/**
 * BƯỚC 1 — Đăng ký người dùng.
 * Lưu thông tin (hoTen, email, sdt, password) vào maxv2_sys.
 * CHƯA tạo công ty / DB nào ở bước này.
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

  await writeLog({ hanhDong: 'REGISTER', userId: user.id, chiTiet: { email } });

  return { id: user.id, hoTen, email, sdt: user.sdt };
}

/**
 * Đăng nhập: xác thực email + mật khẩu, trả về user + context công ty.
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

  const company = user.donViId
    ? await sysPrisma.donVi.findUnique({
        where: { id: user.donViId },
        select: { id: true, maSoThue: true, slug: true, tenDonVi: true, status: true },
      })
    : null;

  await writeLog({
    hanhDong: 'LOGIN',
    userId: user.id,
    donViId: user.donViId ?? undefined,
  });

  return {
    user: {
      id: user.id,
      hoTen: user.hoTen,
      email: user.email,
      role: user.role,
      donViId: user.donViId,
    },
    company,
  };
}

/**
 * Tải lại user theo id để cấp access token mới (refresh).
 * Đọc lại từ DB để token mới phản ánh role/donViId hiện tại, không tin payload cũ.
 */
export async function loadUserForRefresh(userId: string) {
  const user = await sysPrisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError(MESSAGES.AUTH.REFRESH_INVALID);
  }
  return { id: user.id, role: user.role, donViId: user.donViId };
}

import { sysPrisma } from '../../config/db.sys';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../../utils/password';
import { generateOtp } from '../../utils/otp';
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  OTP_TTL_MINUTES,
} from '../../constants/auth';
import { resetPasswordOtpEmail } from '../../helpers/mailTemplates';
import { writeLog } from '../shared/syslog.service';
import { sendMail } from '../shared/mailer.service';
import { welcomeEmail } from '../../helpers/mailTemplates';
import { createTrialSubscription } from '../shared/subscription.service';
import { listAccessibleCompanies } from '../shared/companyAccess.service';
import { canAccessDonVi } from '../../helpers/access';
import { ConflictError, UnauthorizedError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
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

  // Email chào mừng — BEST-EFFORT: SMTP lỗi KHÔNG được hủy đăng ký. Khác với
  // adminInvite (rollback khi gửi lỗi vì mật khẩu chỉ tồn tại trong email đó):
  // ở đây người dùng tự đặt mật khẩu nên vẫn đăng nhập được dù mail không tới.
  //
  // KHÔNG await: `.catch()` chỉ chặn unhandled rejection chứ không rút ngắn thời gian
  // chờ. Nếu cổng SMTP bị firewall chặn, await sẽ treo request đăng ký tới khi timeout
  // -> user tưởng lỗi, bấm lại và nhận 409 dù tài khoản đã tạo xong. Không dòng nào
  // phía sau phụ thuộc kết quả gửi mail.
  // Giữ userId riêng: closure dưới chỉ cần id, không nên neo cả bản ghi `user`
  // (có `password` hash) sống thêm tới khi SMTP settle.
  const userId = user.id;
  void sendMail({ to: email, ...welcomeEmail({ hoTen, email }) }).catch((err) =>
    console.error(`[registerUser] sendMail lỗi cho owner ${userId}:`, err),
  );

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
    tokenVersion: user.tokenVersion,
    companies,
    activeDonViId,
  };
}

/**
 * BƯỚC 1 QUÊN MẬT KHẨU — phát OTP gửi về email.
 *
 * KHÔNG bao giờ tiết lộ email có tồn tại hay không: mọi nhánh đều kết thúc êm, controller
 * trả đúng một message. Nếu phân biệt được thì endpoint này thành công cụ dò tài khoản.
 */
export async function requestPasswordReset(input: ForgotPasswordInput) {
  const { email } = input;
  const user = await sysPrisma.user.findUnique({ where: { email } });

  // Email không tồn tại / tài khoản bị khoá -> im lặng bỏ qua, vẫn báo "đã gửi".
  if (!user || !user.isActive) return;

  // Trần theo email: rate limit của Fastify tính theo IP nên không chặn được kẻ đổi IP
  // để dội mail vào hộp thư nạn nhân.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await sysPrisma.passwordResetOtp.count({
    where: { userId: user.id, createdAt: { gte: oneHourAgo } },
  });
  if (recentCount >= OTP_MAX_PER_HOUR) return;

  const otp = generateOtp();
  const otpHash = await hashPassword(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Huỷ mã cũ còn sống rồi mới phát mã mới — mỗi lúc chỉ tồn tại đúng 1 mã dùng được.
  await sysPrisma.$transaction([
    sysPrisma.passwordResetOtp.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    sysPrisma.passwordResetOtp.create({
      data: { userId: user.id, otpHash, expiresAt },
    }),
  ]);

  await writeLog({
    hanhDong: 'REQUEST_PASSWORD_RESET',
    userId: user.id,
    chiTiet: { email },
  });

  // Không await: SMTP treo không được kéo dài response (xem ghi chú ở registerUser).
  const userId = user.id;
  void sendMail({
    to: email,
    ...resetPasswordOtpEmail({
      hoTen: user.hoTen,
      otp,
      expiresInMinutes: OTP_TTL_MINUTES,
    }),
  }).catch((err) =>
    console.error(`[requestPasswordReset] sendMail lỗi cho user ${userId}:`, err),
  );
}

/**
 * BƯỚC 2 — đối chiếu OTP rồi đặt mật khẩu mới.
 *
 * Mọi lý do thất bại (sai mã, hết hạn, đã dùng, sai quá số lần, email không tồn tại) đều
 * ném CÙNG một lỗi `OTP_INVALID` để không rò rỉ trạng thái tài khoản.
 * Thành công thì tăng `tokenVersion` -> mọi refresh token đã phát trở nên vô hiệu.
 */
export async function resetPasswordWithOtp(input: ResetPasswordInput) {
  const { email, otp, newPassword } = input;
  const user = await sysPrisma.user.findUnique({ where: { email } });
  if (!user) throw new UnauthorizedError(MESSAGES.AUTH.OTP_INVALID);

  const record = await sysPrisma.passwordResetOtp.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.attemptCount >= OTP_MAX_ATTEMPTS) {
    throw new UnauthorizedError(MESSAGES.AUTH.OTP_INVALID);
  }

  const ok = await verifyPassword(otp, record.otpHash);
  if (!ok) {
    // Đếm lần sai TRƯỚC khi trả lỗi — chạm trần thì lần sau vào nhánh chết ở trên.
    await sysPrisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { attemptCount: { increment: 1 } },
    });
    throw new UnauthorizedError(MESSAGES.AUTH.OTP_INVALID);
  }

  const passwordHash = await hashPassword(newPassword);

  // Một transaction: đổi mật khẩu + đá mọi phiên cũ + đánh dấu mã đã dùng.
  // Tách rời sẽ có cửa sổ mà mã đã tiêu nhưng mật khẩu chưa đổi (hoặc ngược lại).
  await sysPrisma.$transaction([
    sysPrisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash, tokenVersion: { increment: 1 } },
    }),
    sysPrisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await writeLog({
    hanhDong: 'RESET_PASSWORD',
    userId: user.id,
    chiTiet: { email },
  });
}

/**
 * Tải lại user theo id để cấp access token mới (refresh).
 * Đọc lại role từ DB (không tin payload cũ) và giữ lại công ty đang chọn từ refresh
 * token — nhưng chỉ khi user VẪN còn quyền vào công ty đó (quyền có thể đã bị thu hồi).
 *
 * `tokenVersion` trong token phải khớp DB: đặt lại mật khẩu tăng cột này nên mọi refresh
 * token phát trước đó bị chặn ở đây — đây là chỗ duy nhất thu hồi được phiên đã cấp.
 */
export async function loadUserForRefresh(
  userId: string,
  tokenDonViId: string | null,
  tokenVersion: number,
) {
  const user = await sysPrisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive || user.tokenVersion !== tokenVersion) {
    throw new UnauthorizedError(MESSAGES.AUTH.REFRESH_INVALID);
  }

  let donViId: string | null = null;
  if (
    tokenDonViId &&
    (await canAccessDonVi(user.id, user.role, tokenDonViId))
  ) {
    donViId = tokenDonViId;
  }

  return {
    id: user.id,
    role: user.role,
    donViId,
    tokenVersion: user.tokenVersion,
  };
}

/**
 * Nạp lại phiên hiện tại cho GET /auth/me (bootstrap FE khi tải trang): user + danh sách
 * công ty + công ty đang chọn. `donViId` lấy từ access token; nếu quyền đã bị thu hồi thì rơi
 * về công ty đầu tiên còn quyền. Cùng shape với `loginUser` để FE dùng chung.
 */
export async function loadUserSession(
  userId: string,
  tokenDonViId: string | null,
) {
  const user = await sysPrisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError(MESSAGES.AUTH.UNAUTHORIZED);
  }

  const companies = await listAccessibleCompanies(user.id, user.role);
  const activeDonViId =
    tokenDonViId && (await canAccessDonVi(user.id, user.role, tokenDonViId))
      ? tokenDonViId
      : (companies[0]?.id ?? null);

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

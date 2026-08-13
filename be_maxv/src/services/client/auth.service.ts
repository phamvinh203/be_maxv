import { sysPrisma } from '../../config/db.sys';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../../utils/password';
import { generateOtp } from '../../utils/otp';
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  OTP_TTL_MINUTES,
} from '../../constants/auth';
import {
  resetPasswordOtpEmail,
  welcomeEmail,
} from '../../helpers/mailTemplates';
import { writeLog } from '../shared/syslog.service';
import { sendMail } from '../shared/mailer.service';
import { createTrialSubscription } from '../shared/subscription.service';
import { listAccessibleCompanies } from '../shared/companyAccess.service';
import { moduleCuaUser } from '../shared/modules.service';
import { canAccessDonVi } from '../../helpers/access';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../helpers/errors';
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
    modules: await moduleCuaUser(user),
  };
}

/**
 * BƯỚC 1 QUÊN MẬT KHẨU — phát OTP gửi về email.
 *
 * BÁO RÕ khi email chưa đăng ký, thay vì im lặng trả 200 như thiết kế chống dò tài khoản
 * kinh điển. Lý do: `/auth/register` vốn đã trả 409 "Email đã tồn tại" với cùng rate limit,
 * nên khả năng dò tài khoản ĐÃ tồn tại sẵn — giấu ở đây không mua thêm bảo mật, chỉ khiến
 * người gõ nhầm email ngồi chờ mã không bao giờ tới mà không hiểu vì sao.
 * Muốn thật sự chống dò thì phải xử lý cả `/auth/register` trước, rồi mới quay lại đây.
 */
export async function requestPasswordReset(input: ForgotPasswordInput) {
  const { email } = input;

  const user = await sysPrisma.user.findUnique({ where: { email } });
  if (!user) throw new NotFoundError(MESSAGES.AUTH.EMAIL_NOT_REGISTERED);
  if (!user.isActive) {
    throw new UnauthorizedError(MESSAGES.AUTH.ACCOUNT_INACTIVE);
  }

  // Trần theo email: rate limit của Fastify tính theo IP nên không chặn được kẻ đổi IP
  // để dội mail vào hộp thư nạn nhân.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await sysPrisma.passwordResetOtp.count({
    where: { userId: user.id, createdAt: { gte: oneHourAgo } },
  });
  if (recentCount >= OTP_MAX_PER_HOUR) {
    throw new ConflictError(MESSAGES.AUTH.OTP_TOO_MANY_REQUESTS);
  }

  const otp = generateOtp();
  const otpHash = await hashPassword(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Huỷ mã cũ còn sống rồi mới phát mã mới — mỗi lúc chỉ tồn tại đúng 1 mã dùng được.
  // Kèm dọn bản ghi cũ hơn cửa sổ đếm: bảng này chỉ ghi thêm, không có job dọn nào khác.
  // Mốc `oneHourAgo` chọn đúng bằng cửa sổ của OTP_MAX_PER_HOUR để không phá phép đếm ở trên.
  await sysPrisma.$transaction([
    sysPrisma.passwordResetOtp.deleteMany({
      where: { userId: user.id, createdAt: { lt: oneHourAgo } },
    }),
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
  /**
   * Mọi lý do hỏng ở bước này (sai mã / hết hạn / đã dùng / hết lượt) đều trả CÙNG một
   * message. Đây KHÔNG phải chống dò tài khoản (bước 1 đã báo rõ email có tồn tại hay
   * không) mà là để người đang dò mã không biết mình đã bị chặn hay chỉ đoán sai.
   */
  // Chú thích kiểu đặt trên BIẾN (không phải trên arrow) — đó là điều kiện để TypeScript
  // coi lời gọi là điểm kết thúc luồng và thu hẹp `user`/`record` thành non-null bên dưới.
  const rejectOtp: () => never = () => {
    throw new UnauthorizedError(MESSAGES.AUTH.OTP_INVALID);
  };

  const user = await sysPrisma.user.findUnique({ where: { email } });

  // Tài khoản bị khoá thì khỏi truy vấn OTP — kết cục vẫn là từ chối.
  const record = user?.isActive
    ? await sysPrisma.passwordResetOtp.findFirst({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  if (!user || !record) rejectOtp();

  // Tăng bộ đếm TRƯỚC khi so mã, bằng UPDATE có điều kiện: đọc-rồi-ghi sẽ hở ~100ms
  // (thời gian bcrypt) đủ để hàng trăm request song song cùng đọc attemptCount=0 và cùng
  // được đoán một lần -> trần 5 lần thành vô nghĩa. `count === 0` = đã hết lượt hoặc mã
  // vừa bị request khác tiêu mất.
  const { count: allowed } = await sysPrisma.passwordResetOtp.updateMany({
    where: {
      id: record.id,
      usedAt: null,
      attemptCount: { lt: OTP_MAX_ATTEMPTS },
    },
    data: { attemptCount: { increment: 1 } },
  });
  if (allowed === 0) rejectOtp();

  const ok = await verifyPassword(otp, record.otpHash);
  if (!ok) throw new UnauthorizedError(MESSAGES.AUTH.OTP_INVALID);

  const passwordHash = await hashPassword(newPassword);

  // Tiêu mã bằng UPDATE có điều kiện `usedAt: null` NGAY TRONG transaction: hai request
  // cùng mang một mã đúng đều qua được các bước trên, chỉ request thắng cuộc mới đổi được
  // mật khẩu. Thiếu điều kiện này thì cả hai cùng ghi, tokenVersion tăng 2 lần và mật khẩu
  // cuối cùng là của request về sau — người dùng đặt mật khẩu A nhưng nhận mật khẩu B.
  await sysPrisma.$transaction(async (tx) => {
    const { count: consumed } = await tx.passwordResetOtp.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed === 0) throw new UnauthorizedError(MESSAGES.AUTH.OTP_INVALID);

    await tx.user.update({
      where: { id: user.id },
      data: { password: passwordHash, tokenVersion: { increment: 1 } },
    });
  });

  await writeLog({
    hanhDong: 'RESET_PASSWORD',
    userId: user.id,
    chiTiet: { email },
  });
}

/**
 * `tokenVersion` HIỆN TẠI trong DB của 1 user.
 *
 * Dùng khi cấp lại bộ token ngoài luồng login/refresh (đổi công ty, tạo công ty). Không
 * lấy từ `req.user.tokenVersion`: access token không được đối chiếu DB, nên nếu vừa có
 * đợt đặt lại mật khẩu thì payload đó đã cũ và ta sẽ ký ra refresh token chết ngay từ đầu.
 * Bất biến cần giữ: mọi refresh token vừa phát đều mang version khớp DB.
 */
export async function currentTokenVersion(userId: string): Promise<number> {
  const user = await sysPrisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true },
  });
  if (!user) throw new UnauthorizedError(MESSAGES.AUTH.UNAUTHORIZED);
  return user.tokenVersion;
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
  // undefined = token ký TRƯỚC khi có tokenVersion. Coi như 0 để khớp giá trị migration
  // backfill cho mọi user cũ, tránh đá toàn bộ phiên đang đăng nhập ngay lúc deploy.
  // Bỏ `?? 0` được sau khi mọi refresh token cũ đã hết hạn (quá refreshTtl).
  tokenVersion: number | undefined,
) {
  // Chỉ lấy 4 cột thật sự dùng: hàm này chạy mỗi lần access token hết hạn của MỌI phiên
  // đang mở, không cần kéo cả bản ghi (gồm cả hash mật khẩu) về.
  const user = await sysPrisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true, tokenVersion: true },
  });
  if (!user || !user.isActive || user.tokenVersion !== (tokenVersion ?? 0)) {
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
    modules: await moduleCuaUser(user),
  };
}

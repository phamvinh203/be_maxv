/**
 * Luật kiểm tra dùng chung cho các form auth, soi theo zod của be_maxv.
 *
 * Đặt riêng để đăng ký và đặt lại mật khẩu KHÔNG lệch nhau — backend cũng gom
 * `passwordRule` vì cùng lý do: nếu luật đặt lại lỏng hơn luật đăng ký thì đó là
 * một đường vòng để hạ cấp mật khẩu.
 *
 * Mỗi hàm trả message lỗi, hoặc `undefined` nếu hợp lệ.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[0-9]{9,11}$/;

/** Khớp `.max(100)` của `hoTen` trong `registerSchema` (be_maxv). */
export const HO_TEN_MAX = 100;

/** Khớp `OTP_LENGTH` trong be_maxv/src/constants/auth.ts. */
export const OTP_LENGTH = 6;

/** Khớp `OTP_TTL_MINUTES` — chỉ dùng để hiển thị cho người dùng. */
export const OTP_TTL_MINUTES = 10;

const OTP_RE = new RegExp(`^[0-9]{${OTP_LENGTH}}$`);

export function checkEmail(v: string): string | undefined {
  const email = v.trim();
  if (!email) return "Vui lòng nhập email.";
  if (!EMAIL_RE.test(email)) return "Email không hợp lệ.";
  return undefined;
}

export function checkPhone(v: string): string | undefined {
  const sdt = v.trim();
  if (!sdt) return "Vui lòng nhập số điện thoại.";
  if (!PHONE_RE.test(sdt)) return "Số điện thoại phải gồm 9-11 chữ số.";
  return undefined;
}

/** Khớp `passwordRule` (zod): tối thiểu 8 ký tự, có ít nhất 1 chữ và 1 số. */
export function checkPassword(v: string): string | undefined {
  if (v.length < 8) return "Mật khẩu tối thiểu 8 ký tự.";
  if (!/[A-Za-z]/.test(v)) return "Mật khẩu phải có ít nhất 1 chữ cái.";
  if (!/[0-9]/.test(v)) return "Mật khẩu phải có ít nhất 1 chữ số.";
  return undefined;
}

/** Luật riêng của FE — backend không nhận trường xác nhận mật khẩu. */
export function checkPasswordConfirm(
  password: string,
  confirm: string,
): string | undefined {
  if (!confirm) return "Vui lòng xác nhận mật khẩu.";
  if (confirm !== password) return "Mật khẩu xác nhận không khớp.";
  return undefined;
}

/**
 * Bỏ các khóa rỗng khỏi object lỗi, để `Object.keys(errors).length` phản ánh đúng số lỗi
 * thật (gán `errors.x = checkX(...)` luôn tạo khóa, kể cả khi hợp lệ).
 *
 * Lọc cả `undefined` LẪN chuỗi rỗng: nếu sau này có hàm check trả `""` cho trường hợp hợp
 * lệ thì khóa đó vẫn tính là lỗi, chặn submit mà không hiện chữ nào — lỗi rất khó lần ra.
 * Trả `Partial<T>` chứ không phải `T`: hàm này XOÁ khóa nên không thể hứa giữ nguyên kiểu.
 */
export function pruneEmpty<T extends object>(errors: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(errors).filter(([, v]) => v),
  ) as Partial<T>;
}

export function checkOtp(v: string): string | undefined {
  const otp = v.trim();
  if (!otp) return "Vui lòng nhập mã xác thực.";
  if (!OTP_RE.test(otp)) return `Mã xác thực gồm ${OTP_LENGTH} chữ số.`;
  return undefined;
}

/** Khớp `hoTen` trong `registerSchema`: bắt buộc, tối đa 100 ký tự, không xuống dòng. */
export function checkHoTen(v: string): string | undefined {
  const hoTen = v.trim();
  if (!hoTen) return "Vui lòng nhập họ tên.";
  if (hoTen.length > HO_TEN_MAX) return `Họ tên tối đa ${HO_TEN_MAX} ký tự.`;
  if (/[\r\n]/.test(hoTen)) return "Họ tên không được xuống dòng.";
  return undefined;
}

import type {
  ResetPasswordFieldErrors,
  ResetPasswordFormValues,
} from "../types";
import {
  checkOtp,
  checkPassword,
  checkPasswordConfirm,
  pruneEmpty,
} from "./rules";

/** Giá trị rỗng ban đầu của bước 2. Dùng: state khởi tạo của `ForgotPasswordForm`. */
export const EMPTY_RESET_FORM: ResetPasswordFormValues = {
  otp: "",
  newPassword: "",
  xacNhanMatKhau: "",
};

/**
 * Validate bước 2 của luồng quên mật khẩu (OTP + mật khẩu mới), soi theo
 * `resetPasswordSchema` (zod) của be_maxv. Luật mật khẩu lấy từ `rules.ts` — cùng
 * nguồn với form đăng ký, để hai luồng không lệch nhau.
 *
 * Trả object rỗng nghĩa là hợp lệ.
 */
export function validateResetPasswordForm(
  v: ResetPasswordFormValues,
): ResetPasswordFieldErrors {
  return pruneEmpty<ResetPasswordFieldErrors>({
    otp: checkOtp(v.otp),
    newPassword: checkPassword(v.newPassword),
    xacNhanMatKhau: checkPasswordConfirm(v.newPassword, v.xacNhanMatKhau),
  });
}

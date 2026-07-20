import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import PasswordField from "../../../components/PasswordField";
import { forgotPassword, resetPassword } from "../api/authApi";
import {
  EMPTY_RESET_FORM,
  validateResetPasswordForm,
} from "../validators/resetPasswordValidator";
import { OTP_LENGTH, OTP_TTL_MINUTES, checkEmail } from "../validators/rules";
import { getErrorMessage } from "../../../lib/errors";
import type {
  ResetPasswordFieldErrors,
  ResetPasswordFormValues,
} from "../types";

/**
 * Luồng quên mật khẩu 2 bước trên CÙNG một trang:
 *   "email" -> xin OTP  |  "otp" -> nhập OTP + mật khẩu mới
 *
 * Giữ một trang thay vì hai route để email nhập ở bước 1 nằm sẵn trong state — người
 * dùng không phải gõ lại, và không phải đẩy email qua URL (sẽ lọt vào lịch sử/log).
 * Backend nhận OTP + mật khẩu mới trong CÙNG một request nên không cần bước trung gian.
 * Dùng: `ForgotPasswordPage` (route /forgot-password).
 */
export default function ForgotPasswordForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "otp">("email");

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();

  const [form, setForm] = useState<ResetPasswordFormValues>(EMPTY_RESET_FORM);
  const [fieldErrors, setFieldErrors] = useState<ResetPasswordFieldErrors>({});

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setField =
    (key: keyof ResetPasswordFormValues) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  /** Bước 1: xin OTP. Server luôn trả 200 giống nhau nên cứ sang bước 2 khi không có lỗi mạng. */
  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    const err = checkEmail(email);
    setEmailError(err);
    if (err) return;

    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setStep("otp");
    } catch (err) {
      setError(getErrorMessage(err, "Không gửi được mã xác thực."));
    } finally {
      setSubmitting(false);
    }
  };

  /** Bước 2: gửi OTP + mật khẩu mới. Thành công thì về /login (phiên cũ đã bị server thu hồi). */
  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    const errors = validateResetPasswordForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await resetPassword({
        email: email.trim(),
        otp: form.otp.trim(),
        newPassword: form.newPassword,
      });
      navigate("/login", { replace: true, state: { email: email.trim() } });
    } catch (err) {
      // Server gộp mọi lý do (sai mã / hết hạn / quá số lần) vào một message.
      setFieldErrors({ otp: getErrorMessage(err, "Mã xác thực không đúng.") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={step === "email" ? handleRequestOtp : handleReset}
      noValidate
      sx={{
        maxWidth: 420,
        mx: "auto",
        mt: 8,
        p: 3,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        Quên mật khẩu
      </Typography>

      <Stack spacing={2}>
        {step === "email" ? (
          <>
            <Typography variant="body2" color="text.secondary">
              Nhập email đã đăng ký. Chúng tôi sẽ gửi mã xác thực {OTP_LENGTH} chữ số tới
              hộp thư của bạn.
            </Typography>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={!!emailError}
              helperText={emailError}
              fullWidth
              autoFocus
              autoComplete="email"
            />
          </>
        ) : (
          <>
            <Alert severity="info">
              Nếu email <b>{email.trim()}</b> tồn tại trong hệ thống, mã xác thực đã được
              gửi tới hộp thư. Mã có hiệu lực {OTP_TTL_MINUTES} phút.
            </Alert>
            <TextField
              label="Mã xác thực"
              value={form.otp}
              onChange={setField("otp")}
              error={!!fieldErrors.otp}
              helperText={fieldErrors.otp}
              fullWidth
              autoFocus
              autoComplete="one-time-code"
              slotProps={{ htmlInput: { inputMode: "numeric", maxLength: OTP_LENGTH } }}
            />
            <PasswordField
              label="Mật khẩu mới"
              value={form.newPassword}
              onChange={setField("newPassword")}
              error={fieldErrors.newPassword}
            />
            <PasswordField
              label="Xác nhận mật khẩu mới"
              value={form.xacNhanMatKhau}
              onChange={setField("xacNhanMatKhau")}
              error={fieldErrors.xacNhanMatKhau}
            />
          </>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        <Button type="submit" variant="contained" disabled={submitting}>
          {submitting ? (
            <CircularProgress size={22} color="inherit" />
          ) : step === "email" ? (
            "Gửi mã xác thực"
          ) : (
            "Đặt lại mật khẩu"
          )}
        </Button>

        <Stack direction="row" sx={{ justifyContent: "space-between" }}>
          {step === "otp" && (
            // Quay lại để sửa email gõ nhầm. Không tự gửi lại mã — backend giới hạn
            // số OTP mỗi email/giờ, bấm bừa sẽ tiêu hết quota của chính người dùng.
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => {
                setStep("email");
                setError("");
                setFieldErrors({});
              }}
            >
              Đổi email
            </Link>
          )}
          <Typography variant="body2" sx={{ ml: "auto" }}>
            <Link component={RouterLink} to="/login">
              Quay lại đăng nhập
            </Link>
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

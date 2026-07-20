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
import { register } from "../api/authApi";
import { EMPTY_REGISTER_FORM, validateRegisterForm } from "../validators/registerValidator";
import { ApiError } from "../../../lib/http";
import { getErrorMessage } from "../../../lib/errors";
import type { RegisterFieldErrors, RegisterFormValues } from "../types";

/**
 * Form đăng ký tài khoản (POST /auth/register). Thành công thì điều hướng về /login kèm
 * state `{ registered, email }` để LoginForm hiện thông báo và điền sẵn email — backend
 * không cấp cookie ở bước đăng ký nên không thể vào thẳng app.
 * Dùng: `RegisterPage` (route /register).
 */
export default function RegisterForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterFormValues>(EMPTY_REGISTER_FORM);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setField =
    (key: keyof RegisterFormValues) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    const errors = validateRegisterForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const email = form.email.trim();
    setSubmitting(true);
    try {
      await register({
        hoTen: form.hoTen.trim(),
        email,
        sdt: form.sdt.trim(),
        password: form.password,
      });
      navigate("/login", { replace: true, state: { registered: true, email } });
    } catch (err) {
      // 409 = email đã tồn tại -> gắn vào đúng ô Email để người dùng biết sửa chỗ nào.
      if (err instanceof ApiError && err.status === 409) {
        setFieldErrors({ email: err.message });
      } else if (err instanceof ApiError && err.status === 400) {
        // Backend trả 400 kèm `errors` chi tiết nhưng KHÔNG có `message` (xem
        // errorHandler.plugin.ts) -> apiFetch chỉ có chuỗi "Yêu cầu thất bại (400)".
        // Xảy ra khi validate FE lỏng hơn zod (vd zod .email() chặt hơn regex ở đây).
        setError("Thông tin đăng ký không hợp lệ. Vui lòng kiểm tra lại email và số điện thoại.");
      } else {
        setError(getErrorMessage(err, "Đăng ký thất bại."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
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
        Đăng ký tài khoản
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Họ tên"
          value={form.hoTen}
          onChange={setField("hoTen")}
          error={!!fieldErrors.hoTen}
          helperText={fieldErrors.hoTen}
          fullWidth
          autoFocus
          autoComplete="name"
        />
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChange={setField("email")}
          error={!!fieldErrors.email}
          helperText={fieldErrors.email}
          fullWidth
          autoComplete="email"
        />
        <TextField
          label="Số điện thoại"
          value={form.sdt}
          onChange={setField("sdt")}
          error={!!fieldErrors.sdt}
          helperText={fieldErrors.sdt}
          fullWidth
          autoComplete="tel"
        />
        <PasswordField
          label="Mật khẩu"
          value={form.password}
          onChange={setField("password")}
          error={fieldErrors.password}
        />
        <PasswordField
          label="Xác nhận mật khẩu"
          value={form.xacNhanMatKhau}
          onChange={setField("xacNhanMatKhau")}
          error={fieldErrors.xacNhanMatKhau}
        />

        {error && <Alert severity="error">{error}</Alert>}

        <Button type="submit" variant="contained" disabled={submitting}>
          {submitting ? <CircularProgress size={22} color="inherit" /> : "Đăng ký"}
        </Button>

        <Typography variant="body2" sx={{ textAlign: "center" }}>
          Đã có tài khoản?{" "}
          <Link component={RouterLink} to="/login">
            Đăng nhập
          </Link>
        </Typography>
      </Stack>
    </Box>
  );
}

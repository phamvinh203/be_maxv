import { useEffect, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import PasswordField from "../../../components/PasswordField";
import { useAuth } from "../useAuth";
import { getErrorMessage } from "../../../lib/errors";

/** State điều hướng do RegisterForm gửi sang sau khi đăng ký thành công. */
interface LoginLocationState {
  registered?: boolean;
  email?: string;
}

export default function LoginForm() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Đọc 1 lần lúc mount; effect bên dưới xóa state ngay sau đó nên giá trị này không đổi.
  const [fromRegister] = useState(() => (location.state ?? null) as LoginLocationState | null);

  const [email, setEmail] = useState(fromRegister?.email ?? "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Email đã điền sẵn -> focus thẳng vào ô mật khẩu thay vì ô email.
  const prefilled = !!fromRegister?.email;

  // Xóa state điều hướng sau khi đã đọc — nếu không, React Router giữ nó trong history
  // entry nên F5 (hoặc bấm Back về đây) sẽ hiện lại thông báo cũ và lộ email lần trước.
  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err, "Đăng nhập thất bại."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        maxWidth: 360,
        mx: "auto",
        mt: 8,
        p: 3,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        Đăng nhập
      </Typography>
      <Stack spacing={2}>
        
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          autoFocus={!prefilled}
          required
        />
        <PasswordField
          label="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus={prefilled}
          required
        />
        {error && <Alert severity="error">{error}</Alert>}
        
        <Button type="submit" variant="contained" disabled={submitting}>
          {submitting ? <CircularProgress size={22} color="inherit" /> : "Đăng nhập"}
        </Button>

        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          {/* Chưa có API đặt lại mật khẩu — chỉ báo trạng thái, không dựng luồng giả. */}
          <Link
            component="button"
            type="button"
            variant="body2"
            onClick={() => alert("Chức năng chưa có.") }
          >
            Quên mật khẩu?
          </Link>
          <Typography variant="body2">
            <Link component={RouterLink} to="/register">
              Đăng ký
            </Link>
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

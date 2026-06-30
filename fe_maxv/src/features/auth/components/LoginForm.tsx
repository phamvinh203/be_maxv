import { useState, type FormEvent, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useLogin } from '@/features/auth/hooks/useAuth';
import { getApiError } from '@/lib/apiClient';
import { PasswordField } from '@/features/auth/components/PasswordField';

interface Props {
  onSuccess: () => void;
  onRegister: () => void;
}

export function LoginForm({ onSuccess, onRegister }: Props): JSX.Element {
  const { mutate, isPending } = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    setError('');
    mutate(
      { email: email.trim(), password },
      {
        onSuccess,
        onError: (err) =>
          setError(getApiError(err, 'Đăng nhập thất bại. Vui lòng thử lại.')),
      },
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 380 }}>
      <Typography
        variant="h4"
        sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5, letterSpacing: '-0.02em' }}
      >
        Đăng nhập
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#64748b', mb: 4 }}>
        MAXV Accounting — Phần mềm kế toán doanh nghiệp
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            required
            fullWidth
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ten@congty.com"
          />
          <PasswordField
            label="Mật khẩu"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={isPending}
            sx={{
              height: 44,
              fontWeight: 700,
              background: (theme) => theme.gradients.button,
              boxShadow: '0 4px 14px rgba(0,103,232,0.35)',
            }}
          >
            {isPending ? (
              <CircularProgress size={22} sx={{ color: 'white' }} />
            ) : (
              'ĐĂNG NHẬP'
            )}
          </Button>
        </Stack>
      </Box>

      <Typography sx={{ mt: 3, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
        Chưa có tài khoản?{' '}
        <Link component="button" type="button" onClick={onRegister} sx={{ fontWeight: 600 }}>
          Đăng ký dùng thử 7 ngày
        </Link>
      </Typography>

      <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
        <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>
          Hotline hỗ trợ: <b>1900 1234</b> · T2–T7, 8:30–17:30
        </Typography>
      </Box>
    </Box>
  );
}

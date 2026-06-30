import { useState, type ChangeEvent, type FormEvent, type JSX } from 'react';
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
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useRegister } from '@/features/auth/hooks/useAuth';
import { getApiError } from '@/lib/apiClient';
import { PasswordField } from '@/features/auth/components/PasswordField';

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isValidPhone = (v: string) => /^(0[3-9]\d{8})$/.test(v.replace(/\s/g, ''));

type Field = 'ho_ten' | 'email' | 'phone' | 'password' | 'confirm';

interface Props {
  onLogin: () => void;
}

export function RegisterForm({ onLogin }: Props): JSX.Element {
  const { mutate, isPending } = useRegister();
  const [form, setForm] = useState<Record<Field, string>>({
    ho_ten: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [serverError, setServerError] = useState('');
  const [successEmail, setSuccessEmail] = useState('');

  const set = (field: Field) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setFieldErrors((er) => {
      const n = { ...er };
      delete n[field];
      return n;
    });
  };

  function validate(): Partial<Record<Field, string>> {
    const e: Partial<Record<Field, string>> = {};
    if (!form.ho_ten.trim()) e.ho_ten = 'Vui lòng nhập họ tên';
    if (!isValidEmail(form.email)) e.email = 'Email không hợp lệ';
    if (form.phone && !isValidPhone(form.phone))
      e.phone = 'Số điện thoại không hợp lệ (10 số, đầu 0)';
    if (form.password.length < 8) e.password = 'Mật khẩu tối thiểu 8 ký tự';
    if (form.password !== form.confirm) e.confirm = 'Mật khẩu xác nhận không khớp';
    return e;
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    setServerError('');
    const errs = validate();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    const sdt = form.phone.replace(/\s/g, '');
    mutate(
      {
        hoTen: form.ho_ten.trim(),
        email: form.email.trim(),
        password: form.password,
        ...(sdt ? { sdt } : {}),
      },
      {
        onSuccess: () => setSuccessEmail(form.email.trim()),
        onError: (err) =>
          setServerError(
            getApiError(err, 'Đăng ký thất bại. Vui lòng thử lại.'),
          ),
      },
    );
  }

  if (successEmail) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CheckCircleRoundedIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
          Đăng ký thành công!
        </Typography>
        <Typography sx={{ color: '#64748b', fontSize: 14, mb: 1 }}>
          Yêu cầu đăng ký của bạn đã được ghi nhận.
        </Typography>
        <Typography sx={{ color: '#64748b', fontSize: 14, mb: 4 }}>
          Admin sẽ xem xét và gửi thông tin đăng nhập về{' '}
          <b style={{ color: '#334155' }}>{successEmail}</b> trong thời gian sớm nhất.
        </Typography>
        <Button
          variant="contained"
          onClick={onLogin}
          sx={{ height: 44, px: 4, fontWeight: 700, background: (theme) => theme.gradients.button }}
        >
          Về trang đăng nhập
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 420 }}>
      <Typography
        variant="h4"
        sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5, letterSpacing: '-0.02em' }}
      >
        Đăng ký dùng thử
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#64748b', mb: 3.5 }}>
        Miễn phí 7 ngày · Đầy đủ tính năng · Không cần thẻ tín dụng
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {serverError && <Alert severity="error">{serverError}</Alert>}
          <TextField
            label="Họ và tên"
            required
            fullWidth
            autoFocus
            value={form.ho_ten}
            onChange={set('ho_ten')}
            placeholder="Nguyễn Văn A"
            error={!!fieldErrors.ho_ten}
            helperText={fieldErrors.ho_ten}
          />
          <TextField
            label="Email"
            type="email"
            required
            fullWidth
            value={form.email}
            onChange={set('email')}
            placeholder="ten@congty.com"
            error={!!fieldErrors.email}
            helperText={fieldErrors.email}
          />
          <TextField
            label="Số điện thoại"
            type="tel"
            fullWidth
            value={form.phone}
            onChange={set('phone')}
            placeholder="0901234567"
            error={!!fieldErrors.phone}
            helperText={fieldErrors.phone}
          />
          <PasswordField
            label="Mật khẩu"
            required
            value={form.password}
            onChange={set('password')}
            placeholder="Tối thiểu 8 ký tự"
            error={!!fieldErrors.password}
            helperText={fieldErrors.password}
          />
          <PasswordField
            label="Xác nhận mật khẩu"
            required
            value={form.confirm}
            onChange={set('confirm')}
            placeholder="Nhập lại mật khẩu"
            error={!!fieldErrors.confirm}
            helperText={fieldErrors.confirm}
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
              'BẮT ĐẦU DÙNG THỬ 7 NGÀY'
            )}
          </Button>
        </Stack>
      </Box>

      <Typography sx={{ mt: 2.5, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
        Đã có tài khoản?{' '}
        <Link component="button" type="button" onClick={onLogin} sx={{ fontWeight: 600 }}>
          Đăng nhập ngay
        </Link>
      </Typography>

      <Typography sx={{ mt: 2, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
        Bằng cách đăng ký, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của MAXV.
      </Typography>
    </Box>
  );
}

import { useState, type FormEvent, type JSX } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useLogin } from '@/features/auth/hooks/useAuth';

export function LoginForm(): JSX.Element {
  const navigate = useNavigate();
  const { mutate, isPending, isError } = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    mutate(
      { email, password },
      { onSuccess: () => navigate({ to: '/dashboard' }) },
    );
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        width: 360,
        p: 4,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 3,
      }}
    >
      <Stack spacing={2.5}>
        <Box
          component="img"
          src="/Logo-Maxv.png"
          alt="maxv"
          sx={{ height: 38, width: 'auto', alignSelf: 'center', mb: 0.5 }}
        />
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, textAlign: 'center', color: 'text.secondary' }}
        >
          Đăng nhập quản trị
        </Typography>

        {isError && (
          <Alert severity="error">Email hoặc mật khẩu không đúng</Alert>
        )}

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
          autoFocus
        />
        <TextField
          label="Mật khẩu"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isPending}
        >
          {isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </Stack>
    </Box>
  );
}

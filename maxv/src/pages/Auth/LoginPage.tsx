import type { JSX } from 'react';
import { Box } from '@mui/material';
import { LoginForm } from '@/features/auth/components/LoginForm';

export function LoginPage(): JSX.Element {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        // Nền navy + quầng sáng azure (đồng bộ logo)
        background:
          'radial-gradient(80% 60% at 50% 0%, #103a5e 0%, #0a2540 55%, #07182b 100%)',
      }}
    >
      <LoginForm />
    </Box>
  );
}

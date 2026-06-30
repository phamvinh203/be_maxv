import type { JSX } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { DashboardIllustration } from '../components/AuthIllustrations';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { LoginForm } from '@/features/auth/components/LoginForm';

interface Props {
  onRegister: () => void;
  onLoggedIn: () => void;
}

const BADGES = [
  { n: '2.500+', l: 'Doanh nghiệp' },
  { n: '7 ngày', l: 'Dùng thử miễn phí' },
  { n: '24/7', l: 'Hỗ trợ kỹ thuật' },
];

export default function LoginPage({ onRegister, onLoggedIn }: Props): JSX.Element {
  return (
    <AuthLayout
      leftWidth={58}
      hero={
        <>
          <DashboardIllustration />
          <Typography sx={{ mt: 4, fontSize: '1.6rem', fontWeight: 800, color: 'white', lineHeight: 1.3 }}>
            Phần mềm kế toán thông minh
            <br />
            cho doanh nghiệp Việt
          </Typography>
          <Typography sx={{ mt: 1.5, color: '#bfdbfe', fontSize: '0.9rem', maxWidth: 340 }}>
            Tự động hoá kế toán · Quản lý tài chính toàn diện
            <br />
            Kết nối Tổng cục Thuế · Điện toán đám mây
          </Typography>
          <Stack direction="row" spacing={4} sx={{ mt: 4 }}>
            {BADGES.map((b) => (
              <Box key={b.n} sx={{ textAlign: 'center' }}>
                <Typography sx={{ color: 'white', fontWeight: 800, fontSize: 18 }}>{b.n}</Typography>
                <Typography sx={{ color: '#bfdbfe', fontSize: 12, mt: 0.25 }}>{b.l}</Typography>
              </Box>
            ))}
          </Stack>
        </>
      }
    >
      <LoginForm onSuccess={onLoggedIn} onRegister={onRegister} />
    </AuthLayout>
  );
}

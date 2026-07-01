import type { JSX } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { FeatureIllustration } from '../components/AuthIllustrations';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { RegisterForm } from '@/features/auth/components/RegisterForm';

interface Props {
  onLogin: () => void;
}

const STEPS = [
  { n: '1', t: 'Điền thông tin đăng ký' },
  { n: '2', t: 'Nhận email xác nhận & mật khẩu' },
  { n: '3', t: 'Đăng nhập và dùng ngay' },
];

export default function RegisterPage({ onLogin }: Props): JSX.Element {
  return (
    <AuthLayout
      leftWidth={52}
      hero={
        <>
          <FeatureIllustration />
          <Typography sx={{ mt: 4, fontSize: '1.5rem', fontWeight: 800, color: 'white', lineHeight: 1.3 }}>
            Bắt đầu hành trình số hoá
            <br />
            kế toán doanh nghiệp
          </Typography>
          <Typography sx={{ mt: 1.5, color: '#bfdbfe', fontSize: 14, maxWidth: 320 }}>
            Đăng ký miễn phí · Dùng thử 7 ngày đầy đủ tính năng
            <br />
            Không cần thẻ tín dụng · Huỷ bất cứ lúc nào
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 4, width: '100%', maxWidth: 300 }}>
            {STEPS.map((s) => (
              <Stack key={s.n} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                  {s.n}
                </Box>
                <Typography sx={{ color: '#dbeafe', fontSize: 14 }}>{s.t}</Typography>
              </Stack>
            ))}
          </Stack>
        </>
      }
    >
      <RegisterForm onLogin={onLogin} />
    </AuthLayout>
  );
}

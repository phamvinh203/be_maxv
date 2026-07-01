import type { JSX, ReactNode } from 'react';
import { Box, Stack } from '@mui/material';
import logo from '../../../assets/Logo-Maxv.png';

interface Props {
  /** Bề rộng (%) panel trái trên desktop; panel phải lấy phần còn lại. */
  leftWidth: number;
  /** Nội dung hero của panel trái (illustration, tiêu đề, badges/steps). */
  hero: ReactNode;
  /** Nội dung panel phải — thường là form. */
  children: ReactNode;
}

/** Bố cục 2 cột dùng chung cho các trang auth: panel hero trái + panel form phải. */
export function AuthLayout({ leftWidth, hero, children }: Props): JSX.Element {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {/* ── LEFT PANEL ── */}
      <Box
        sx={{
          display: { xs: 'none', lg: 'flex' },
          width: `${leftWidth}%`,
          position: 'relative',
          overflow: 'hidden',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 7,
          background: (theme) => theme.gradients.hero,
        }}
      >
        <Box sx={{ position: 'absolute', top: -96, left: -96, width: 320, height: 320, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />
        <Box sx={{ position: 'absolute', bottom: -80, right: -80, width: 448, height: 448, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />

        <Stack sx={{ position: 'relative', zIndex: 1, alignItems: 'center', textAlign: 'center', width: '100%' }}>
          <Box component="img" src={logo} alt="MAXV" sx={{ width: 160, mb: 5, filter: 'brightness(0) invert(1)' }} />
          {hero}
        </Stack>
      </Box>

      {/* ── RIGHT PANEL ── */}
      <Box
        sx={{
          width: { xs: '100%', lg: `${100 - leftWidth}%` },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'white',
          px: 4,
          py: 6,
          overflowY: 'auto',
        }}
      >
        <Box sx={{ display: { xs: 'flex', lg: 'none' }, justifyContent: 'center', position: 'absolute', top: 24 }}>
          <Box component="img" src={logo} alt="MAXV" sx={{ width: 130 }} />
        </Box>
        {children}
      </Box>
    </Box>
  );
}

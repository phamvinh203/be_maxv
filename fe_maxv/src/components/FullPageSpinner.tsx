import type { JSX } from 'react';
import { Box, CircularProgress } from '@mui/material';

/** Màn chờ toàn trang khi AuthProvider còn đang gọi /auth/me (chưa biết đã đăng nhập chưa). */
export default function FullPageSpinner(): JSX.Element {
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CircularProgress />
    </Box>
  );
}

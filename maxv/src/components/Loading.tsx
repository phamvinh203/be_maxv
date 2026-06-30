import type { JSX } from 'react';
import { Box, CircularProgress } from '@mui/material';

export function Loading(): JSX.Element {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <CircularProgress />
    </Box>
  );
}

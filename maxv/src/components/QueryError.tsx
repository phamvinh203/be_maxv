import type { JSX } from 'react';
import { Alert, AlertTitle, Button, Stack } from '@mui/material';
import { apiErrorMessage } from '@/lib/apiError';

interface Props {
  error: unknown;
  reset?: () => void;
}

/** Fallback dùng cho route errorComponent của TanStack Router. */
export function QueryError({ error, reset }: Props): JSX.Element {
  return (
    <Stack spacing={2} sx={{ p: 3, maxWidth: 560 }}>
      <Alert severity="error">
        <AlertTitle>Không tải được dữ liệu</AlertTitle>
        {apiErrorMessage(error)}
      </Alert>
      {reset && (
        <Button variant="outlined" onClick={reset} sx={{ alignSelf: 'start' }}>
          Thử lại
        </Button>
      )}
    </Stack>
  );
}

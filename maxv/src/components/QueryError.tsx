import type { JSX } from 'react';
import { Alert, AlertTitle, Button, Stack } from '@mui/material';
import { AxiosError } from 'axios';

interface Props {
  error: unknown;
  reset?: () => void;
}

function messageOf(error: unknown): string {
  if (error instanceof AxiosError) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message
    );
  }
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi';
}

/** Fallback dùng cho route errorComponent của TanStack Router. */
export function QueryError({ error, reset }: Props): JSX.Element {
  return (
    <Stack spacing={2} sx={{ p: 3, maxWidth: 560 }}>
      <Alert severity="error">
        <AlertTitle>Không tải được dữ liệu</AlertTitle>
        {messageOf(error)}
      </Alert>
      {reset && (
        <Button variant="outlined" onClick={reset} sx={{ alignSelf: 'start' }}>
          Thử lại
        </Button>
      )}
    </Stack>
  );
}

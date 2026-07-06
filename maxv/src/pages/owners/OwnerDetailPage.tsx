import { Suspense, type JSX } from 'react';
import { Link } from '@tanstack/react-router';
import { Button, Stack } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Loading } from '@/components/Loading';
import { OwnerDetail } from '@/features/owners/components/OwnerDetail';

export function OwnerDetailPage({
  ownerId,
}: {
  ownerId: string;
}): JSX.Element {
  return (
    <Stack spacing={2}>
      <Button
        component={Link}
        to="/owners"
        startIcon={<ArrowBackIcon />}
        sx={{ alignSelf: 'start' }}
      >
        Danh sách tài khoản
      </Button>

      <Suspense fallback={<Loading />}>
        <OwnerDetail id={ownerId} />
      </Suspense>
    </Stack>
  );
}

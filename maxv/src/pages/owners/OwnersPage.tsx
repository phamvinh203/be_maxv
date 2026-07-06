import { Suspense, useMemo, useState, type FormEvent, type JSX } from 'react';
import { Button, Stack, TextField, Typography } from '@mui/material';
import { Loading } from '@/components/Loading';
import { OwnersTable } from '@/features/owners/components/OwnersTable';
import type { ListOwnersParams } from '@/features/owners/types/owner';

export function OwnersPage(): JSX.Element {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const params = useMemo<
    ListOwnersParams & { page: number; pageSize: number }
  >(
    () => ({ page, pageSize, ...(q ? { q } : {}) }),
    [page, pageSize, q],
  );

  function applySearch(e: FormEvent): void {
    e.preventDefault();
    setPage(1);
    setQ(qInput);
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Quản lý tài khoản
      </Typography>

      <Stack
        direction="row"
        spacing={2}
        component="form"
        onSubmit={applySearch}
        sx={{ alignItems: 'center' }}
      >
        <TextField
          label="Tìm theo tên / email"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          sx={{ width: 320 }}
        />
        <Button type="submit" variant="contained">
          Tìm
        </Button>
      </Stack>

      <Suspense fallback={<Loading />}>
        <OwnersTable
          params={params}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPage(1);
            setPageSize(s);
          }}
        />
      </Suspense>
    </Stack>
  );
}

import { Suspense, useMemo, useState, type FormEvent, type JSX } from 'react';
import {
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Loading } from '@/components/Loading';
import { CompaniesTable } from '@/features/companies/components/CompaniesTable';
import type {
  ListCompaniesParams,
  TenantStatus,
} from '@/features/companies/types/company';

const STATUS_OPTIONS: { value: TenantStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'READY', label: 'Hoạt động' },
  { value: 'PROVISIONING', label: 'Đang cấp DB' },
  { value: 'FAILED', label: 'Lỗi cấp DB' },
  { value: 'SUSPENDED', label: 'Tạm khóa' },
];

export function CompaniesPage(): JSX.Element {
  const [status, setStatus] = useState<TenantStatus | ''>('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const params = useMemo<ListCompaniesParams & { page: number; pageSize: number }>(
    () => ({
      page,
      pageSize,
      ...(status ? { status } : {}),
      ...(q ? { q } : {}),
    }),
    [page, pageSize, status, q],
  );

  function applySearch(e: FormEvent): void {
    e.preventDefault();
    setPage(1);
    setQ(qInput);
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Quản lý đơn vị
      </Typography>

      <Stack
        direction="row"
        spacing={2}
        component="form"
        onSubmit={applySearch}
        sx={{ alignItems: 'center' }}
      >
        <TextField
          select
          label="Trạng thái"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as TenantStatus | '');
          }}
          sx={{ width: 200 }}
        >
          {STATUS_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Tìm theo MST / tên"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          sx={{ width: 280 }}
        />
        <Button type="submit" variant="contained">
          Tìm
        </Button>
      </Stack>

      <Suspense fallback={<Loading />}>
        <CompaniesTable
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

import { Suspense, useMemo, useState, type JSX } from 'react';
import { MenuItem, Stack, TextField } from '@mui/material';
import { Loading } from '@/components/Loading';
import { LogsTable } from '@/features/logs/components/LogsTable';
import { useLogActions } from '@/features/logs/hooks/useLogs';
import type { ListLogsParams, LogLevel } from '@/features/logs/types/log';

const LEVELS: (LogLevel | '')[] = ['', 'INFO', 'WARN', 'ERROR'];

export function LogsPage(): JSX.Element {
  const { data: actions } = useLogActions();
  const [level, setLevel] = useState<LogLevel | ''>('');
  const [hanhDong, setHanhDong] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const params = useMemo<ListLogsParams & { page: number; pageSize: number }>(
    () => ({
      page,
      pageSize,
      sort: 'desc',
      ...(level ? { level } : {}),
      ...(hanhDong ? { hanhDong } : {}),
      // ngày -> bao trọn cả ngày (đầu/cuối ngày)
      ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
    }),
    [page, pageSize, level, hanhDong, from, to],
  );

  return (
    <Stack spacing={2.5}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ flexWrap: 'wrap', alignItems: 'center' }}
      >
        <TextField
          select
          label="Mức"
          value={level}
          onChange={(e) => {
            setPage(1);
            setLevel(e.target.value as LogLevel | '');
          }}
          sx={{ width: 140 }}
        >
          {LEVELS.map((l) => (
            <MenuItem key={l || 'all'} value={l}>
              {l || 'Tất cả'}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Hành động"
          value={hanhDong}
          onChange={(e) => {
            setPage(1);
            setHanhDong(e.target.value);
          }}
          sx={{ width: 220 }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          {(actions ?? []).map((a) => (
            <MenuItem key={a} value={a}>
              {a}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          type="date"
          label="Từ ngày"
          value={from}
          onChange={(e) => {
            setPage(1);
            setFrom(e.target.value);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          type="date"
          label="Đến ngày"
          value={to}
          onChange={(e) => {
            setPage(1);
            setTo(e.target.value);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>

      <Suspense fallback={<Loading />}>
        <LogsTable
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

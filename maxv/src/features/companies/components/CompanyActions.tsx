import type { JSX } from 'react';
import { Button, Stack } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import {
  useSuspendCompany,
  useResumeCompany,
  useRetryProvision,
} from '@/features/companies/hooks/useCompanies';
import type { TenantStatus } from '@/features/companies/types/company';

interface Props {
  id: string;
  status: TenantStatus;
}

/** Nút thao tác vòng đời, bật/tắt theo trạng thái hiện tại của công ty. */
export function CompanyActions({ id, status }: Props): JSX.Element {
  const suspend = useSuspendCompany();
  const resume = useResumeCompany();
  const retry = useRetryProvision();
  const busy = suspend.isPending || resume.isPending || retry.isPending;

  return (
    <Stack direction="row" spacing={1.5}>
      {status === 'READY' && (
        <Button
          variant="outlined"
          color="warning"
          startIcon={<BlockIcon />}
          disabled={busy}
          onClick={() => suspend.mutate(id)}
        >
          Tạm khóa
        </Button>
      )}
      {status === 'SUSPENDED' && (
        <Button
          variant="outlined"
          color="success"
          startIcon={<PlayArrowIcon />}
          disabled={busy}
          onClick={() => resume.mutate(id)}
        >
          Mở lại
        </Button>
      )}
      {status === 'FAILED' && (
        <Button
          variant="outlined"
          startIcon={<ReplayIcon />}
          disabled={busy}
          onClick={() => retry.mutate(id)}
        >
          Cấp lại DB
        </Button>
      )}
    </Stack>
  );
}

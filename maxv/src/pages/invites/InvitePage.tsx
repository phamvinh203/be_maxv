import { Suspense, useMemo, useState, type JSX } from 'react';
import { MenuItem, Stack, TextField } from '@mui/material';
import { Loading } from '@/components/Loading';
import { InvitesTable } from '@/features/invites/components/InvitesTable';
import { ApproveInviteDialog } from '@/features/invites/components/ApproveInviteDialog';
import { RejectInviteDialog } from '@/features/invites/components/RejectInviteDialog';
import { useInvites } from '@/features/invites/hooks/useInvites';
import {
  type AdminInvite,
  type InviteStatus,
  type ListInvitesParams,
  INVITE_STATUS_LABELS,
} from '@/features/invites/types/invite';

const STATUS_OPTIONS: { value: InviteStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  ...(Object.entries(INVITE_STATUS_LABELS) as [InviteStatus, string][]).map(
    ([value, label]) => ({ value, label }),
  ),
];

type Params = ListInvitesParams & { page: number; pageSize: number };

interface SectionProps {
  params: Params;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

function InvitesSection({
  params,
  onPageChange,
  onPageSizeChange,
}: SectionProps): JSX.Element {
  const { data } = useInvites(params);
  const [approveTarget, setApproveTarget] = useState<AdminInvite | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminInvite | null>(null);

  return (
    <>
      <InvitesTable
        rows={data.data}
        total={data.total}
        page={params.page}
        pageSize={params.pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onApprove={setApproveTarget}
        onReject={setRejectTarget}
      />
      {approveTarget && (
        <ApproveInviteDialog
          key={approveTarget.id}
          invite={approveTarget}
          onClose={() => setApproveTarget(null)}
        />
      )}
      {rejectTarget && (
        <RejectInviteDialog
          key={rejectTarget.id}
          invite={rejectTarget}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </>
  );
}

export function InvitePage(): JSX.Element {
  const [status, setStatus] = useState<InviteStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const params = useMemo<Params>(
    () => ({ page, pageSize, ...(status ? { status } : {}) }),
    [page, pageSize, status],
  );

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          select
          label="Trạng thái"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as InviteStatus | '');
          }}
          sx={{ width: 180 }}
        >
          {STATUS_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Suspense fallback={<Loading />}>
        <InvitesSection
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

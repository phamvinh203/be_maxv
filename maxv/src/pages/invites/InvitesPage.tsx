import { Suspense, useMemo, useState, type JSX } from 'react';
import { MenuItem, Stack, TextField } from '@mui/material';
import { Loading } from '@/components/Loading';
import { InvitesTable } from '@/features/invites/components/InvitesTable';
import { RejectInviteDialog } from '@/features/invites/components/RejectInviteDialog';
import { ApprovedPasswordDialog } from '@/features/invites/components/ApprovedPasswordDialog';
import { useInvites, useApproveInvite } from '@/features/invites/hooks/useInvites';
import {
  STATUS_LABELS,
  type AdminInvite,
  type InviteStatus,
  type ListInvitesParams,
} from '@/features/invites/types/invite';

const STATUS_OPTIONS: { value: InviteStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING', label: STATUS_LABELS.PENDING },
  { value: 'APPROVED', label: STATUS_LABELS.APPROVED },
  { value: 'REJECTED', label: STATUS_LABELS.REJECTED },
];

type Params = ListInvitesParams & { page: number; pageSize: number };

interface SectionProps {
  params: Params;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

function InvitesSection({ params, onPageChange, onPageSizeChange }: SectionProps): JSX.Element {
  const { data } = useInvites(params);
  const approve = useApproveInvite();
  const [rejectTarget, setRejectTarget] = useState<AdminInvite | null>(null);
  const [approved, setApproved] = useState<{ email: string; password: string } | null>(null);

  function handleApprove(invite: AdminInvite): void {
    if (!window.confirm(`Duyệt lời mời cho "${invite.email}"?`)) return;
    approve.mutate(invite.id, { onSuccess: (d) => setApproved(d) });
  }

  return (
    <>
      <InvitesTable
        rows={data.data}
        total={data.total}
        page={params.page}
        pageSize={params.pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onApprove={handleApprove}
        onReject={setRejectTarget}
      />
      {rejectTarget && (
        <RejectInviteDialog
          key={rejectTarget.id}
          invite={rejectTarget}
          onClose={() => setRejectTarget(null)}
        />
      )}
      {approved && (
        <ApprovedPasswordDialog
          email={approved.email}
          password={approved.password}
          onClose={() => setApproved(null)}
        />
      )}
    </>
  );
}

export function InvitesPage(): JSX.Element {
  const [status, setStatus] = useState<InviteStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const params = useMemo<Params>(
    () => ({ page, pageSize, ...(status ? { status } : {}) }),
    [page, pageSize, status],
  );

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <TextField
          select
          label="Trạng thái"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as InviteStatus | '');
          }}
          sx={{ width: 200 }}
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

import type { JSX } from 'react';
import { Chip } from '@mui/material';
import { STATUS_LABELS, type InviteStatus } from '@/features/invites/types/invite';

const COLOR: Record<InviteStatus, 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

export function InviteStatusChip({ status }: { status: InviteStatus }): JSX.Element {
  return <Chip label={STATUS_LABELS[status]} color={COLOR[status]} size="small" />;
}

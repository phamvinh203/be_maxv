import type { JSX } from 'react';
import { Chip } from '@mui/material';
import type { InviteStatus } from '@/features/company/types/company';

const LABELS: Record<InviteStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
};

const COLORS: Record<InviteStatus, 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

export function InviteStatusChip({ status }: { status: InviteStatus }): JSX.Element {
  return <Chip label={LABELS[status]} color={COLORS[status]} size="small" />;
}

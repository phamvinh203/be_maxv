import type { JSX } from 'react';
import { Chip } from '@mui/material';
import type { UserStatus } from '@/features/users/types/user';

const MAP: Record<
  UserStatus,
  { label: string; color: 'warning' | 'success' | 'error' }
> = {
  PENDING: { label: 'Chờ duyệt', color: 'warning' },
  ACTIVE: { label: 'Hoạt động', color: 'success' },
  REJECTED: { label: 'Từ chối', color: 'error' },
};

export function UserStatusChip({ status }: { status: UserStatus }): JSX.Element {
  const { label, color } = MAP[status];
  return <Chip label={label} color={color} size="small" />;
}

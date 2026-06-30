import type { JSX } from 'react';
import { Chip } from '@mui/material';
import type { SubStatus } from '@/features/subscriptions/types/subscription';

const MAP: Record<
  SubStatus,
  { label: string; color: 'info' | 'success' | 'warning' | 'error' | 'default' }
> = {
  TRIALING: { label: 'Dùng thử', color: 'info' },
  ACTIVE: { label: 'Đang hoạt động', color: 'success' },
  PAST_DUE: { label: 'Quá hạn', color: 'warning' },
  CANCELED: { label: 'Đã hủy', color: 'default' },
  EXPIRED: { label: 'Hết hạn', color: 'error' },
};

export function SubStatusChip({ status }: { status: SubStatus }): JSX.Element {
  const { label, color } = MAP[status];
  return <Chip label={label} color={color} size="small" />;
}

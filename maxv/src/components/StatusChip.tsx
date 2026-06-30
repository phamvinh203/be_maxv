import type { JSX } from 'react';
import { Chip } from '@mui/material';
import type { TenantStatus } from '@/features/companies/types/company';

const MAP: Record<
  TenantStatus,
  { label: string; color: 'success' | 'warning' | 'error' | 'default' }
> = {
  READY: { label: 'Hoạt động', color: 'success' },
  PROVISIONING: { label: 'Đang cấp DB', color: 'warning' },
  FAILED: { label: 'Lỗi cấp DB', color: 'error' },
  SUSPENDED: { label: 'Tạm khóa', color: 'default' },
};

export function StatusChip({ status }: { status: TenantStatus }): JSX.Element {
  const { label, color } = MAP[status];
  return <Chip label={label} color={color} size="small" />;
}

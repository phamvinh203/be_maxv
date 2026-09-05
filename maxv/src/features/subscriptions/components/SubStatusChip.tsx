import type { JSX } from 'react';
import { Chip, Tooltip } from '@mui/material';
import type { SubStatus } from '@/features/subscriptions/types/subscription';
import { hetHanNhungStatusChuaDoi } from '@/features/subscriptions/hieuLuc';

const MAP: Record<
  SubStatus,
  { label: string; color: 'info' | 'success' | 'warning' | 'error' | 'default' }
> = {
  TRIALING: { label: 'Miễn phí', color: 'info' },
  ACTIVE: { label: 'Đang hoạt động', color: 'success' },
  PAST_DUE: { label: 'Quá hạn', color: 'warning' },
  CANCELED: { label: 'Đã hủy', color: 'default' },
  EXPIRED: { label: 'Hết hạn', color: 'error' },
};

/**
 * Trạng thái thuê bao — tính theo `ketThuc` chứ không chỉ đọc cột `status`.
 *
 * `status` một mình là NGUỒN KHÔNG ĐÁNG TIN: không có tác vụ nào hạ nó xuống `EXPIRED`
 * khi hết hạn, nên nó đứng yên ở `TRIALING`/`ACTIVE` mãi mãi trong khi API đã cắt module.
 * Truyền `ketThuc` vào để chip nói đúng cái người dùng đang chịu (xem `hieuLuc.ts`).
 */
export function SubStatusChip({
  status,
  ketThuc = null,
}: {
  status: SubStatus;
  ketThuc?: string | null;
}): JSX.Element {
  if (hetHanNhungStatusChuaDoi(status, ketThuc)) {
    return (
      <Tooltip
        title={`Đã quá hạn ${new Date(ketThuc as string).toLocaleDateString('vi-VN')} nên mọi module của tài khoản này đang bị khóa, dù trạng thái lưu trong hệ thống vẫn là "${MAP[status].label}". Bấm "Gia hạn" để mở lại.`}
      >
        <Chip label="Hết hạn" color="error" size="small" />
      </Tooltip>
    );
  }
  const { label, color } = MAP[status];
  return <Chip label={label} color={color} size="small" />;
}

import type { ReactNode } from 'react';
import { Chip } from '@mui/material';

/** 1 cột của bảng danh mục — header + cách hiển thị từng ô (theo mẫu `PickerColumn` của PickerDialog). */
export interface CatalogColumn<T> {
  label: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
}

/** Cột "Trạng thái" (Đang dùng/Ngừng) — giống hệt ở cả 7 màn danh mục tồn kho, khai 1 lần dùng chung. */
export function statusColumn<T extends { status: string }>(): CatalogColumn<T> {
  return {
    label: 'Trạng thái',
    align: 'center',
    render: (r) => (
      <Chip
        size="small"
        label={r.status === '1' ? 'Đang dùng' : 'Ngừng'}
        color={r.status === '1' ? 'success' : 'default'}
        variant="outlined"
      />
    ),
  };
}

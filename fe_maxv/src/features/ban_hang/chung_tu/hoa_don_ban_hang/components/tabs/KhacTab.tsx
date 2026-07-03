import type { JSX } from 'react';
import { PlaceholderTab } from './PlaceholderTab';

/** Tab "Khác" — thông tin thuế/ghi chú (chưa có cột ở BE). */
export function KhacTab(): JSX.Element {
  return (
    <PlaceholderTab
      title="Thông tin khác"
      fields={[
        'Tên khách (hóa đơn thuế)',
        'Địa chỉ (hóa đơn thuế)',
        'Mã số thuế',
        'Nhóm hàng',
        'Ghi chú',
      ]}
    />
  );
}

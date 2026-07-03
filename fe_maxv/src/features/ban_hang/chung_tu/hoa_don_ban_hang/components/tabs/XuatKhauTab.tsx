import type { JSX } from 'react';
import { PlaceholderTab } from './PlaceholderTab';

/** Tab "Xuất khẩu" — thông tin vận đơn/giao nhận (chưa có cột ở BE). */
export function XuatKhauTab(): JSX.Element {
  return (
    <PlaceholderTab
      title="Thông tin xuất khẩu"
      fields={[
        'Invoice',
        'Số vận đơn',
        'Địa điểm giao hàng',
        'Địa điểm nhận hàng',
        'Đơn vị vận chuyển',
        'Ghi chú',
      ]}
    />
  );
}

import type { JSX } from 'react';
import { PlaceholderTab } from './PlaceholderTab';

/** Tab "HĐĐT" — hóa đơn điện tử (chưa có cột ở BE). */
export function HddtTab(): JSX.Element {
  return (
    <PlaceholderTab
      title="Hóa đơn điện tử"
      fields={[
        'Mẫu hóa đơn',
        'Ký hiệu HĐĐT',
        'Số hóa đơn',
        'Ngày ký',
        'Trạng thái phát hành',
        'Email',
      ]}
    />
  );
}

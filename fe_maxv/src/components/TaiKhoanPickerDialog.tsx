import type { JSX } from 'react';
import { PickerDialog } from '@/components/PickerDialog';
import { useTaiKhoanList } from '@/features/tong_hop/danh_muc/tai_khoan/hooks/useTaiKhoan';
import type { TaiKhoan } from '@/features/tong_hop/danh_muc/tai_khoan/types';
import { isTopLevelAccount, topLevelRowSx } from '@/features/tong_hop/danh_muc/tai_khoan/rowStyle';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (tk: TaiKhoan) => void;
}

const filterTk = (r: TaiKhoan, q: string): boolean =>
  r.tk.toLowerCase().includes(q) || r.ten_tk.toLowerCase().includes(q);

/** Dialog chọn 1 tài khoản (GET từ API tài khoản). Dùng cho các ô nhập TK. */
export function TaiKhoanPickerDialog({
  open,
  title = 'Chọn tài khoản',
  onClose,
  onSelect,
}: Props): JSX.Element {
  const { data, isLoading, isError, error } = useTaiKhoanList();
  return (
    <PickerDialog<TaiKhoan>
      open={open}
      title={title}
      noun="tài khoản"
      rows={data ?? []}
      isLoading={isLoading}
      isError={isError}
      error={error}
      getKey={(r) => r.tk}
      filter={filterTk}
      rowSx={(r) => (isTopLevelAccount(r) ? topLevelRowSx : undefined)}
      columns={[
        { label: 'Tài khoản', width: 120, bold: true, render: (r) => r.tk },
        { label: 'Tên tài khoản', render: (r) => r.ten_tk },
      ]}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}

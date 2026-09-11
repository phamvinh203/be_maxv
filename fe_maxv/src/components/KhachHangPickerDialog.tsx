import { useEffect, useState, type JSX } from 'react';
import { PickerDialog } from '@/components/PickerDialog';
import { useKhachHangList } from '@/features/ban_hang/danh_muc/dm_KH/hooks/useKhachHang';
import type { KhachHang } from '@/features/ban_hang/danh_muc/dm_KH/types';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (kh: KhachHang) => void;
}

/** Số khách hàng tối đa hiện trong dialog — gõ thêm để thu hẹp. */
const SO_DONG_TOI_DA = 50;
/** Ngừng gõ bao lâu mới gửi từ khóa lên server. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Dialog chọn 1 khách hàng — TÌM Ở SERVER (danh mục có thể rất lớn, không tải cả bảng): chỉ lấy
 * `SO_DONG_TOI_DA` khách hàng khớp đầu tiên theo mã / tên / MST.
 */
export function KhachHangPickerDialog({
  open,
  title = 'Chọn khách hàng',
  onClose,
  onSelect,
}: Props): JSX.Element {
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error } = useKhachHangList(
    { page: 1, pageSize: SO_DONG_TOI_DA, q },
    open,
  );
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <PickerDialog<KhachHang>
      open={open}
      title={title}
      noun="khách hàng"
      rows={rows}
      isLoading={isLoading}
      isError={isError}
      error={error}
      getKey={(r) => r.ma_kh}
      onSearchChange={setSearchInput}
      footerNote={
        total > rows.length
          ? `Đang hiện ${rows.length}/${total} khách hàng — gõ thêm để thu hẹp.`
          : undefined
      }
      columns={[
        { label: 'Mã KH', width: 120, bold: true, render: (r) => r.ma_kh },
        { label: 'Tên khách hàng', render: (r) => r.ten_kh },
        { label: 'MST', width: 130, render: (r) => r.ma_so_thue || '—' },
      ]}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}

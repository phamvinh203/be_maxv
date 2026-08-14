import type { JSX } from "react";
import { PickerDialog } from "@/components/Accounting/PickerDialog";
import { useKhachHangList } from "@/features/accounting/ban_hang/danh_muc/dm_KH/hooks/useKhachHang";
import type { KhachHang } from "@/features/accounting/ban_hang/danh_muc/dm_KH/types";

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (kh: KhachHang) => void;
}

const filterKh = (r: KhachHang, q: string): boolean =>
  r.ma_kh.toLowerCase().includes(q) ||
  r.ten_kh.toLowerCase().includes(q) ||
  (r.ma_so_thue ?? "").toLowerCase().includes(q);

/** Dialog chọn 1 khách hàng (GET từ API khách hàng). */
export function KhachHangPickerDialog({
  open,
  title = "Chọn khách hàng",
  onClose,
  onSelect,
}: Props): JSX.Element {
  const { data, isLoading, isError, error } = useKhachHangList({
    enabled: open,
  });
  return (
    <PickerDialog<KhachHang>
      open={open}
      title={title}
      noun="khách hàng"
      rows={data ?? []}
      isLoading={isLoading}
      isError={isError}
      error={error}
      getKey={(r) => r.ma_kh}
      filter={filterKh}
      columns={[
        { label: "Mã KH", width: 120, bold: true, render: (r) => r.ma_kh },
        { label: "Tên khách hàng", render: (r) => r.ten_kh },
        { label: "MST", width: 130, render: (r) => r.ma_so_thue || "—" },
      ]}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}

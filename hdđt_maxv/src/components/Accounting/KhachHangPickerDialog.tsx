import { useEffect, useState, type JSX } from "react";
import { PickerDialog } from "@/components/Accounting/PickerDialog";
import { useKhachHangList } from "@/features/accounting/ban_hang/danh_muc/dm_KH/hooks/useKhachHang";
import type { KhachHang } from "@/features/accounting/ban_hang/danh_muc/dm_KH/types";

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (kh: KhachHang) => void;
}

/** Dialog chọn 1 khách hàng — tìm kiếm phía server (khuôn `VatTuPickerDialog.tsx`). */
export function KhachHangPickerDialog({
  open,
  title = "Chọn khách hàng",
  onClose,
  onSelect,
}: Props): JSX.Element {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, error } = useKhachHangList(
    { q: debounced, pageSize: 50 },
    { enabled: open },
  );

  return (
    <PickerDialog<KhachHang>
      open={open}
      title={title}
      noun="khách hàng"
      rows={data?.items ?? []}
      isLoading={isLoading}
      isError={isError}
      error={error}
      getKey={(r) => r.ma_kh}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Tìm mã / tên / MST khách hàng…"
      selectHint="Nhấp vào một dòng để chọn khách hàng."
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

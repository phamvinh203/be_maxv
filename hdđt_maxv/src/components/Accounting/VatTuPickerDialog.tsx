import { useEffect, useState, type JSX } from "react";
import { PickerDialog } from "@/components/Accounting/PickerDialog";
import { useHangHoaList } from "@/features/accounting/ton_kho/danh_muc/hang_hoa/hooks/useHangHoa";
import type { HangHoa } from "@/features/accounting/ton_kho/danh_muc/hang_hoa/types";

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (vt: HangHoa) => void;
}

/** Dialog chọn 1 hàng hóa, vật tư (danh mục hàng hóa) — tìm kiếm phía server. */
export function VatTuPickerDialog({
  open,
  title = "Danh mục hàng hóa, vật tư",
  onClose,
  onSelect,
}: Props): JSX.Element {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, error } = useHangHoaList(
    { search: debounced, limit: 50 },
    { enabled: open },
  );

  return (
    <PickerDialog<HangHoa>
      open={open}
      title={title}
      noun="hàng hóa"
      rows={data?.data ?? []}
      isLoading={isLoading}
      isError={isError}
      error={error}
      getKey={(r) => r.ma_vt}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Tìm mã / tên hàng hóa…"
      selectHint="Nhấp vào một dòng để chọn hàng hóa."
      columns={[
        { label: "Mã hàng", width: 110, bold: true, render: (r) => r.ma_vt },
        { label: "Tên hàng", render: (r) => r.ten_vt },
        { label: "Đvt", width: 60, align: "center", render: (r) => r.dvt },
        { label: "Tk vật tư", width: 90, render: (r) => r.tk_vt || "—" },
        { label: "TK doanh thu", width: 100, render: (r) => r.tk_dt || "—" },
        { label: "TK giá vốn", width: 100, render: (r) => r.tk_gv || "—" },
      ]}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}

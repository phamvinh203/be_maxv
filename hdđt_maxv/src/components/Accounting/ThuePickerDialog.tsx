import type { JSX } from "react";
import { PickerDialog } from "@/components/Accounting/PickerDialog";
import {
  useThueList,
  type ThueItem,
} from "@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/hooks/useThueList";

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (thue: ThueItem) => void;
}

const filterThue = (r: ThueItem, q: string): boolean =>
  r.ma_thue.toLowerCase().includes(q) || r.ten_thue.toLowerCase().includes(q);

/** Dialog chọn 1 mã thuế (danh mục suất thuế GTGT) — hiện mã + tên. */
export function ThuePickerDialog({
  open,
  title = "Danh mục suất thuế GTGT",
  onClose,
  onSelect,
}: Props): JSX.Element {
  const { data, isLoading, isError, error } = useThueList({ enabled: open });
  return (
    <PickerDialog<ThueItem>
      open={open}
      title={title}
      noun="mã thuế"
      rows={data ?? []}
      isLoading={isLoading}
      isError={isError}
      error={error}
      getKey={(r) => r.ma_thue}
      filter={filterThue}
      columns={[
        { label: "Mã thuế", width: 110, bold: true, render: (r) => r.ma_thue },
        { label: "Tên thuế", render: (r) => r.ten_thue },
      ]}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}

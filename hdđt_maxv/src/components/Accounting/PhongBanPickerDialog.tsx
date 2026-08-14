import type { JSX } from "react";
import { PickerDialog } from "@/components/Accounting/PickerDialog";
import { usePhongBanList } from "@/features/accounting/tong_hop/danh_muc/phong_ban/hooks/usePhongBan";
import type { PhongBan } from "@/features/accounting/tong_hop/danh_muc/phong_ban/types";

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (pb: PhongBan) => void;
}

const filterPb = (r: PhongBan, q: string): boolean =>
  r.ma_pb.toLowerCase().includes(q) || r.ten_pb.toLowerCase().includes(q);

/** Dialog chọn 1 phòng ban (GET từ danh mục phòng ban) — hiện mã + tên. */
export function PhongBanPickerDialog({
  open,
  title = "Chọn phòng ban",
  onClose,
  onSelect,
}: Props): JSX.Element {
  const { data, isLoading, isError, error } = usePhongBanList({
    enabled: open,
  });
  return (
    <PickerDialog<PhongBan>
      open={open}
      title={title}
      noun="phòng ban"
      rows={data ?? []}
      isLoading={isLoading}
      isError={isError}
      error={error}
      getKey={(r) => r.ma_pb}
      filter={filterPb}
      columns={[
        {
          label: "Mã phòng ban",
          width: 130,
          bold: true,
          render: (r) => r.ma_pb,
        },
        { label: "Tên phòng ban", render: (r) => r.ten_pb },
      ]}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}

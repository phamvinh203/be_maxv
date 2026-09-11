import { useMemo, useState, type JSX } from "react";
import EditIcon from "@mui/icons-material/Edit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import { getApiError } from "@/lib/apiClient";
import DeleteDialog from "@/components/Accounting/DeleteDialog";
import { CatalogTableShell } from "@/components/Accounting/catalog/CatalogTableShell";
import {
  statusColumn,
  type CatalogColumn,
} from "@/components/Accounting/catalog/catalogColumns";
import { useCatalogList } from "@/components/Accounting/catalog/useCatalogList";
import {
  useDeleteKho,
  useKhoList,
} from "@/features/accounting/ton_kho/danh_muc/kho/hooks/useKho";
import type { Kho } from "@/features/accounting/ton_kho/danh_muc/kho/types";
import { KhoFormDialog, type KhoMode } from "./KhoFormDialog";

const SEARCH_KEYS = ["ma_kho", "ten_kho"];

const COLUMNS: CatalogColumn<Kho>[] = [
  // RVW-TK-008: hiện đúng ma_dvcs của dòng, không phải luôn tên công ty đang chọn
  { label: "Đơn vị", render: (r) => r.ma_dvcs },
  { label: "Mã kho", bold: true, render: (r) => r.ma_kho },
  { label: "Tên kho", render: (r) => r.ten_kho },
  // RVW-TK-013: ten_nhkho (join nhóm kho) BE đã trả nhưng trước đây không cột nào hiển thị
  { label: "Nhóm kho", render: (r) => r.ten_nhkho || "—" },
  statusColumn<Kho>(),
];

export function KhoList(): JSX.Element {
  const { data, isLoading, isFetching, isError, error, refetch } = useKhoList();
  const del = useDeleteKho();

  const rows = useMemo(() => data ?? [], [data]);
  const list = useCatalogList<Kho>({
    rows,
    getId: (r) => r.ma_kho,
    searchKeys: SEARCH_KEYS,
  });
  const { selected, setSelectedId } = list;

  const [form, setForm] = useState<{
    open: boolean;
    mode: KhoMode;
    current: Kho | null;
  }>({
    open: false,
    mode: "new",
    current: null,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openForm = (mode: KhoMode, current: Kho | null) =>
    setForm({ open: true, mode, current });

  function confirmDelete() {
    if (!selected) return;
    list.setActionError("");
    del.mutate(selected.ma_kho, {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelectedId(null);
      },
      onError: (err) => list.setActionError(getApiError(err, "Xóa thất bại.")),
    });
  }

  return (
    <>
      <CatalogTableShell<Kho>
        addLabel="Thêm kho hàng"
        onAdd={() => openForm("new", null)}
        searchPlaceholder="Tìm mã / tên kho…"
        onRefresh={() => void refetch()}
        actions={[
          {
            title: "Sửa",
            icon: <EditIcon fontSize="small" />,
            disabled: !selected,
            onClick: () => selected && openForm("edit", selected),
          },
          {
            title: "Copy",
            icon: <ContentCopyIcon fontSize="small" />,
            disabled: !selected,
            onClick: () => selected && openForm("copy", selected),
          },
          {
            title: "Xóa",
            icon: <DeleteIcon fontSize="small" />,
            disabled: !selected,
            color: "error",
            onClick: () => setDeleteOpen(true),
          },
        ]}
        infoLabel="Danh mục kho hàng"
        countSuffix="kho"
        columns={COLUMNS}
        getRowKey={(r) => r.ma_kho}
        onRowDoubleClick={(r) => openForm("edit", r)}
        notFoundLabel="Không tìm thấy kho phù hợp"
        emptyLabel="Chưa có kho nào"
        list={list}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        error={error}
      />

      {/* Dialogs */}
      <KhoFormDialog
        open={form.open}
        mode={form.mode}
        current={form.current}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa kho hàng"
        message={
          selected
            ? `Bạn có chắc chắn muốn xóa kho "${selected.ma_kho} - ${selected.ten_kho}"? Hành động này không thể hoàn tác.`
            : ""
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

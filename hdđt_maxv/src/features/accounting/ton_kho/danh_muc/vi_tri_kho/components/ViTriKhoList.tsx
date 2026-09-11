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
  useDeleteViTri,
  useViTriList,
} from "@/features/accounting/ton_kho/danh_muc/vi_tri_kho/hooks/useViTriKho";
import {
  rowId,
  type ViTri,
} from "@/features/accounting/ton_kho/danh_muc/vi_tri_kho/types";
import { ViTriKhoFormDialog, type ViTriMode } from "./ViTriKhoFormDialog";

const SEARCH_KEYS = ["ma_kho", "ma_vi_tri", "ten_vi_tri"];

const COLUMNS: CatalogColumn<ViTri>[] = [
  { label: "Kho", render: (r) => r.ten_kho || r.ma_kho },
  { label: "Mã vị trí", bold: true, render: (r) => r.ma_vi_tri },
  { label: "Tên vị trí", render: (r) => r.ten_vi_tri },
  { label: "Tên khác", render: (r) => r.ten_vi_tri2 || "—" },
  statusColumn<ViTri>(),
];

export function ViTriKhoList(): JSX.Element {
  const { data, isLoading, isFetching, isError, error, refetch } =
    useViTriList();
  const del = useDeleteViTri();

  const rows = useMemo(() => data ?? [], [data]);
  const list = useCatalogList<ViTri>({
    rows,
    getId: rowId,
    searchKeys: SEARCH_KEYS,
  });
  const { selected, setSelectedId } = list;

  const [form, setForm] = useState<{
    open: boolean;
    mode: ViTriMode;
    current: ViTri | null;
  }>({
    open: false,
    mode: "new",
    current: null,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openForm = (mode: ViTriMode, current: ViTri | null) =>
    setForm({ open: true, mode, current });

  function confirmDelete() {
    if (!selected) return;
    list.setActionError("");
    del.mutate(
      { maKho: selected.ma_kho, maViTri: selected.ma_vi_tri },
      {
        onSuccess: () => {
          setDeleteOpen(false);
          setSelectedId(null);
        },
        onError: (err) =>
          list.setActionError(getApiError(err, "Xóa thất bại.")),
      },
    );
  }

  return (
    <>
      <CatalogTableShell<ViTri>
        addLabel="Thêm vị trí kho"
        onAdd={() => openForm("new", null)}
        searchPlaceholder="Tìm kho / mã / tên vị trí…"
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
        infoLabel="Danh mục vị trí kho hàng"
        countSuffix="vị trí"
        columns={COLUMNS}
        getRowKey={rowId}
        onRowDoubleClick={(r) => openForm("edit", r)}
        notFoundLabel="Không tìm thấy vị trí phù hợp"
        emptyLabel="Chưa có vị trí kho nào"
        list={list}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        error={error}
      />

      {/* Dialogs */}
      <ViTriKhoFormDialog
        open={form.open}
        mode={form.mode}
        current={form.current}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa vị trí kho"
        message={
          selected
            ? `Bạn có chắc chắn muốn xóa vị trí "${selected.ma_kho} / ${selected.ma_vi_tri} - ${selected.ten_vi_tri}"? Hành động này không thể hoàn tác.`
            : ""
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

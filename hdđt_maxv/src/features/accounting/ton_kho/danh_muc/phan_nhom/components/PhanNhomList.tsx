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
  useDeletePhanNhom,
  usePhanNhomList,
} from "@/features/accounting/ton_kho/danh_muc/phan_nhom/hooks/usePhanNhom";
import {
  LOAI_NH_OPTIONS,
  rowId,
  type PhanNhom,
} from "@/features/accounting/ton_kho/danh_muc/phan_nhom/types";
import { PhanNhomFormDialog, type PhanNhomMode } from "./PhanNhomFormDialog";

const SEARCH_KEYS = ["ma_nh", "ten_nh"];
const loaiLabel = (v: number): string =>
  LOAI_NH_OPTIONS.find((o) => o.value === v)?.label ?? String(v);

const COLUMNS: CatalogColumn<PhanNhom>[] = [
  { label: "Loại nhóm", render: (r) => loaiLabel(r.loai_nh) },
  { label: "Mã nhóm", bold: true, render: (r) => r.ma_nh },
  { label: "Tên nhóm", render: (r) => r.ten_nh },
  { label: "Tên khác", render: (r) => r.ten_nh2 || "—" },
  statusColumn<PhanNhom>(),
];

export function PhanNhomList(): JSX.Element {
  const { data, isLoading, isFetching, isError, error, refetch } =
    usePhanNhomList();
  const del = useDeletePhanNhom();

  const rows = useMemo(() => data ?? [], [data]);
  const list = useCatalogList<PhanNhom>({
    rows,
    getId: rowId,
    searchKeys: SEARCH_KEYS,
  });
  const { selected, setSelectedId } = list;

  const [form, setForm] = useState<{
    open: boolean;
    mode: PhanNhomMode;
    current: PhanNhom | null;
  }>({
    open: false,
    mode: "new",
    current: null,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openForm = (mode: PhanNhomMode, current: PhanNhom | null) =>
    setForm({ open: true, mode, current });

  function confirmDelete() {
    if (!selected) return;
    list.setActionError("");
    del.mutate(rowId(selected), {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelectedId(null);
      },
      onError: (err) => list.setActionError(getApiError(err, "Xóa thất bại.")),
    });
  }

  return (
    <>
      <CatalogTableShell<PhanNhom>
        addLabel="Thêm nhóm"
        onAdd={() => openForm("new", null)}
        searchPlaceholder="Tìm mã / tên nhóm…"
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
        infoLabel="Danh mục phân nhóm hàng hóa, vật tư"
        countSuffix="nhóm"
        columns={COLUMNS}
        getRowKey={rowId}
        onRowDoubleClick={(r) => openForm("edit", r)}
        notFoundLabel="Không tìm thấy nhóm phù hợp"
        emptyLabel="Chưa có nhóm nào"
        list={list}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        error={error}
      />

      {/* Dialogs */}
      <PhanNhomFormDialog
        open={form.open}
        mode={form.mode}
        current={form.current}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa nhóm hàng hóa"
        message={
          selected
            ? `Bạn có chắc chắn muốn xóa nhóm "${selected.ma_nh} - ${selected.ten_nh}"? Hành động này không thể hoàn tác.`
            : ""
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

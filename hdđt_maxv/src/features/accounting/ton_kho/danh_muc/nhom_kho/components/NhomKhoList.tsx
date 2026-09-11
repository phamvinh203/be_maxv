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
  useDeleteNhomKho,
  useNhomKhoList,
} from "@/features/accounting/ton_kho/danh_muc/nhom_kho/hooks/useNhomKho";
import type { NhomKho } from "@/features/accounting/ton_kho/danh_muc/nhom_kho/types";
import { NhomKhoFormDialog, type NhomKhoMode } from "./NhomKhoFormDialog";

const SEARCH_KEYS = ["ma_nh", "ten_nh"];

const COLUMNS: CatalogColumn<NhomKho>[] = [
  { label: "Mã nhóm", bold: true, render: (r) => r.ma_nh },
  { label: "Tên nhóm", render: (r) => r.ten_nh },
  { label: "Tên khác", render: (r) => r.ten_nh2 || "—" },
  statusColumn<NhomKho>(),
];

export function NhomKhoList(): JSX.Element {
  const { data, isLoading, isFetching, isError, error, refetch } =
    useNhomKhoList();
  const del = useDeleteNhomKho();

  const rows = useMemo(() => data ?? [], [data]);
  const list = useCatalogList<NhomKho>({
    rows,
    getId: (r) => r.ma_nh,
    searchKeys: SEARCH_KEYS,
  });
  const { selected, setSelectedId } = list;

  const [form, setForm] = useState<{
    open: boolean;
    mode: NhomKhoMode;
    current: NhomKho | null;
  }>({
    open: false,
    mode: "new",
    current: null,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openForm = (mode: NhomKhoMode, current: NhomKho | null) =>
    setForm({ open: true, mode, current });

  function confirmDelete() {
    if (!selected) return;
    list.setActionError("");
    del.mutate(selected.ma_nh, {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelectedId(null);
      },
      onError: (err) => list.setActionError(getApiError(err, "Xóa thất bại.")),
    });
  }

  return (
    <>
      <CatalogTableShell<NhomKho>
        addLabel="Thêm nhóm kho"
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
        infoLabel="Danh mục nhóm kho hàng"
        countSuffix="nhóm"
        columns={COLUMNS}
        getRowKey={(r) => r.ma_nh}
        onRowDoubleClick={(r) => openForm("edit", r)}
        notFoundLabel="Không tìm thấy nhóm phù hợp"
        emptyLabel="Chưa có nhóm kho nào"
        list={list}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        error={error}
      />

      {/* Dialogs */}
      <NhomKhoFormDialog
        open={form.open}
        mode={form.mode}
        current={form.current}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa nhóm kho"
        message={
          selected
            ? `Bạn có chắc chắn muốn xóa nhóm kho "${selected.ma_nh} - ${selected.ten_nh}"? Hành động này không thể hoàn tác.`
            : ""
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

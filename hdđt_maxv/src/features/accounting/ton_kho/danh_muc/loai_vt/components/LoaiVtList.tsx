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
  useDeleteLoaiVt,
  useLoaiVtList,
} from "@/features/accounting/ton_kho/danh_muc/loai_vt/hooks/useLoaiVt";
import type { LoaiVt } from "@/features/accounting/ton_kho/danh_muc/loai_vt/types";
import { LoaiVtFormDialog, type LoaiVtMode } from "./LoaiVtFormDialog";

const SEARCH_KEYS = ["ma_loai_vt", "ten_loai_vt"];

const COLUMNS: CatalogColumn<LoaiVt>[] = [
  { label: "Mã loại", bold: true, render: (r) => r.ma_loai_vt },
  { label: "Tên loại", render: (r) => r.ten_loai_vt },
  { label: "Tên khác", render: (r) => r.ten_loai_vt2 || "—" },
  statusColumn<LoaiVt>(),
];

export function LoaiVtList(): JSX.Element {
  const { data, isLoading, isFetching, isError, error, refetch } =
    useLoaiVtList();
  const del = useDeleteLoaiVt();

  const rows = useMemo(() => data ?? [], [data]);
  const list = useCatalogList<LoaiVt>({
    rows,
    getId: (r) => r.ma_loai_vt,
    searchKeys: SEARCH_KEYS,
  });
  const { selected, setSelectedId } = list;

  const [form, setForm] = useState<{
    open: boolean;
    mode: LoaiVtMode;
    current: LoaiVt | null;
  }>({
    open: false,
    mode: "new",
    current: null,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openForm = (mode: LoaiVtMode, current: LoaiVt | null) =>
    setForm({ open: true, mode, current });

  function confirmDelete() {
    if (!selected) return;
    list.setActionError("");
    del.mutate(selected.ma_loai_vt, {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelectedId(null);
      },
      onError: (err) => list.setActionError(getApiError(err, "Xóa thất bại.")),
    });
  }

  return (
    <>
      <CatalogTableShell<LoaiVt>
        addLabel="Thêm loại vật tư"
        onAdd={() => openForm("new", null)}
        searchPlaceholder="Tìm mã / tên loại…"
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
        infoLabel="Danh mục loại vật tư"
        countSuffix="loại"
        columns={COLUMNS}
        getRowKey={(r) => r.ma_loai_vt}
        onRowDoubleClick={(r) => openForm("edit", r)}
        notFoundLabel="Không tìm thấy loại phù hợp"
        emptyLabel="Chưa có loại vật tư nào"
        list={list}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        error={error}
      />

      {/* Dialogs */}
      <LoaiVtFormDialog
        open={form.open}
        mode={form.mode}
        current={form.current}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa loại vật tư"
        message={
          selected
            ? `Bạn có chắc chắn muốn xóa loại "${selected.ma_loai_vt} - ${selected.ten_loai_vt}"? Hành động này không thể hoàn tác.`
            : ""
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

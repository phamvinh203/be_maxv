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
  useDeleteMaGd,
  useMaGdList,
} from "@/features/accounting/ton_kho/danh_muc/ma_gd/hooks/useMaGd";
import {
  rowId,
  type MaGd,
} from "@/features/accounting/ton_kho/danh_muc/ma_gd/types";
import { MaGdFormDialog, type MaGdMode } from "./MaGdFormDialog";

const SEARCH_KEYS = ["ma_ct", "ma_gd", "ten_gd"];

const COLUMNS: CatalogColumn<MaGd>[] = [
  { label: "Mã chứng từ", bold: true, render: (r) => r.ma_ct },
  { label: "Loại chứng từ", render: (r) => r.loai_ct || "—" },
  { label: "Mã giao dịch", bold: true, render: (r) => r.ma_gd },
  { label: "Tên giao dịch", render: (r) => r.ten_gd },
  statusColumn<MaGd>(),
];

export function MaGdList(): JSX.Element {
  const { data, isLoading, isFetching, isError, error, refetch } =
    useMaGdList();
  const del = useDeleteMaGd();

  const rows = useMemo(() => data ?? [], [data]);
  const list = useCatalogList<MaGd>({
    rows,
    getId: rowId,
    searchKeys: SEARCH_KEYS,
  });
  const { selected, setSelectedId } = list;

  const [form, setForm] = useState<{
    open: boolean;
    mode: MaGdMode;
    current: MaGd | null;
  }>({
    open: false,
    mode: "new",
    current: null,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openForm = (mode: MaGdMode, current: MaGd | null) =>
    setForm({ open: true, mode, current });

  function confirmDelete() {
    if (!selected) return;
    list.setActionError("");
    del.mutate(
      { maCt: selected.ma_ct, maGd: selected.ma_gd },
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
      <CatalogTableShell<MaGd>
        addLabel="Thêm mã giao dịch"
        onAdd={() => openForm("new", null)}
        searchPlaceholder="Tìm mã CT / mã GD / tên…"
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
        infoLabel="Danh mục mã giao dịch"
        countSuffix="mã giao dịch"
        columns={COLUMNS}
        getRowKey={rowId}
        onRowDoubleClick={(r) => openForm("edit", r)}
        notFoundLabel="Không tìm thấy mã giao dịch phù hợp"
        emptyLabel="Chưa có mã giao dịch nào"
        list={list}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        error={error}
      />

      {/* Dialogs */}
      <MaGdFormDialog
        open={form.open}
        mode={form.mode}
        current={form.current}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa mã giao dịch"
        message={
          selected
            ? `Bạn có chắc chắn muốn xóa mã giao dịch "${selected.ma_ct} / ${selected.ma_gd} - ${selected.ten_gd}"? Hành động này không thể hoàn tác.`
            : ""
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

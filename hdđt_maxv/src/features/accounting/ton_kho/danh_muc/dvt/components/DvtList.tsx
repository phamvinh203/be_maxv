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
  useDeleteDvt,
  useDvtList,
} from "@/features/accounting/ton_kho/danh_muc/dvt/hooks/useDvt";
import type { Dvt } from "@/features/accounting/ton_kho/danh_muc/dvt/types";
import { DvtFormDialog, type DvtMode } from "./DvtFormDialog";

const SEARCH_KEYS = ["dvt", "ten_dvt"];

const COLUMNS: CatalogColumn<Dvt>[] = [
  { label: "Mã ĐVT", bold: true, render: (r) => r.dvt },
  { label: "ĐVT 2", render: (r) => r.dvt2 || "—" },
  { label: "Tên đơn vị tính", render: (r) => r.ten_dvt },
  statusColumn<Dvt>(),
];

export function DvtList(): JSX.Element {
  const { data, isLoading, isFetching, isError, error, refetch } = useDvtList();
  const del = useDeleteDvt();

  const rows = useMemo(() => data ?? [], [data]);
  const list = useCatalogList<Dvt>({
    rows,
    getId: (r) => r.dvt,
    searchKeys: SEARCH_KEYS,
  });
  const { selected, setSelectedId } = list;

  const [form, setForm] = useState<{
    open: boolean;
    mode: DvtMode;
    current: Dvt | null;
  }>({
    open: false,
    mode: "new",
    current: null,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openForm = (mode: DvtMode, current: Dvt | null) =>
    setForm({ open: true, mode, current });

  function confirmDelete() {
    if (!selected) return;
    list.setActionError("");
    del.mutate(selected.dvt, {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelectedId(null);
      },
      onError: (err) => list.setActionError(getApiError(err, "Xóa thất bại.")),
    });
  }

  return (
    <>
      <CatalogTableShell<Dvt>
        addLabel="Thêm đơn vị tính"
        onAdd={() => openForm("new", null)}
        searchPlaceholder="Tìm mã / tên ĐVT…"
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
        infoLabel="Danh mục đơn vị tính"
        countSuffix="đơn vị"
        columns={COLUMNS}
        getRowKey={(r) => r.dvt}
        onRowDoubleClick={(r) => openForm("edit", r)}
        notFoundLabel="Không tìm thấy đơn vị tính phù hợp"
        emptyLabel="Chưa có đơn vị tính nào"
        list={list}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        error={error}
      />

      {/* Dialogs */}
      <DvtFormDialog
        open={form.open}
        mode={form.mode}
        current={form.current}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa đơn vị tính"
        message={
          selected
            ? `Bạn có chắc chắn muốn xóa đơn vị tính "${selected.dvt} - ${selected.ten_dvt}"? Hành động này không thể hoàn tác.`
            : ""
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

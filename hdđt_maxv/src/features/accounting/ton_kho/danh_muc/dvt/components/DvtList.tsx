import { useMemo, useState, type JSX } from "react";
import {
  Alert,
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import { getApiError } from "@/lib/apiClient";
import DeleteDialog from "@/components/Accounting/DeleteDialog";
import { CatalogToolbar } from "@/components/Accounting/catalog/CatalogToolbar";
import { useCatalogList } from "@/components/Accounting/catalog/useCatalogList";
import {
  useDeleteDvt,
  useDvtList,
} from "@/features/accounting/ton_kho/danh_muc/dvt/hooks/useDvt";
import type { Dvt } from "@/features/accounting/ton_kho/danh_muc/dvt/types";
import { DvtFormDialog, type DvtMode } from "./DvtFormDialog";

const SEARCH_KEYS = ["dvt", "ten_dvt"];

export function DvtList(): JSX.Element {
  const { data, isLoading, isFetching, isError, error, refetch } = useDvtList();
  const del = useDeleteDvt();

  const rows = useMemo(() => data ?? [], [data]);
  const list = useCatalogList<Dvt>({
    rows,
    getId: (r) => r.dvt,
    searchKeys: SEARCH_KEYS,
  });
  const { selected, setSelected } = list;

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
        setSelected(null);
      },
      onError: (err) => list.setActionError(getApiError(err, "Xóa thất bại.")),
    });
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: "background.default",
      }}
    >
      <CatalogToolbar
        addLabel="Thêm đơn vị tính"
        onAdd={() => openForm("new", null)}
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
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
      />

      {/* Info bar */}
      <Stack
        direction="row"
        sx={{ alignItems: "center", px: 2, py: 0.5, gap: 1 }}
      >
        <Typography variant="body2" color="text.secondary">
          Danh mục đơn vị tính
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: "auto" }}
        >
          {isLoading ? "đang tải…" : `${list.filtered.length} đơn vị`}
          {isFetching && !isLoading ? " · đang cập nhật…" : ""}
        </Typography>
      </Stack>

      {(isError || list.actionError) && (
        <Alert severity="error" sx={{ mx: 2, mb: 1, py: 0 }}>
          {list.actionError || getApiError(error, "Không tải được danh sách.")}
        </Alert>
      )}

      {/* Table */}
      <TableContainer sx={{ flex: 1, minHeight: 0 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Mã ĐVT</TableCell>
              <TableCell>ĐVT 2</TableCell>
              <TableCell>Tên đơn vị tính</TableCell>
              <TableCell align="center">Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  align="center"
                  sx={{ py: 4, color: "text.secondary" }}
                >
                  Đang tải…
                </TableCell>
              </TableRow>
            )}
            {list.paged.map((r) => (
              <TableRow
                key={r.dvt}
                hover
                selected={list.isSelected(r)}
                onClick={() => list.toggleSelect(r)}
                onDoubleClick={() => openForm("edit", r)}
                sx={{ cursor: "pointer", opacity: r.status === "0" ? 0.55 : 1 }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{r.dvt}</TableCell>
                <TableCell>{r.dvt2 || "—"}</TableCell>
                <TableCell>{r.ten_dvt}</TableCell>
                <TableCell align="center">
                  <Chip
                    size="small"
                    label={r.status === "1" ? "Đang dùng" : "Ngừng"}
                    color={r.status === "1" ? "success" : "default"}
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && list.filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  align="center"
                  sx={{ py: 6, color: "text.secondary" }}
                >
                  {list.searchInput
                    ? "Không tìm thấy đơn vị tính phù hợp"
                    : "Chưa có đơn vị tính nào"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={list.filtered.length}
        page={list.page}
        onPageChange={(_, p) => list.setPage(p)}
        rowsPerPage={list.rpp}
        onRowsPerPageChange={(e) => {
          list.setRpp(Number(e.target.value));
          list.setPage(0);
        }}
        rowsPerPageOptions={[25, 50, 100]}
        labelRowsPerPage="Số dòng/trang"
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
    </Box>
  );
}

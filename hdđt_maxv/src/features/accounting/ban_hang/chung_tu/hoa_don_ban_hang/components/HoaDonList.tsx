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
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteIcon from "@mui/icons-material/Delete";
import { getApiError } from "@/lib/apiClient";
import { fmt } from "@/utils/format";
import DeleteDialog from "@/components/Accounting/DeleteDialog";
import { CatalogToolbar } from "@/components/Accounting/catalog/CatalogToolbar";
import { useCatalogList } from "@/components/Accounting/catalog/useCatalogList";
import {
  useDeleteHoaDon,
  useHoaDonList,
} from "@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/hooks/useHoaDonBanHang";
import type { HoaDon } from "@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/types";
import { HoaDonFormDialog, type HoaDonMode } from "./HoaDonFormDialog";

const SEARCH_KEYS = ["so_ct", "ma_kh", "ten_kh", "dien_giai"];

const money = (v: string | number): string => fmt(Number(v) || 0);
const day = (v: string | null): string =>
  v ? new Date(v).toLocaleDateString("vi-VN") : "—";

const STATUS: Record<
  string,
  { label: string; color: "success" | "default" | "warning" }
> = {
  "2": { label: "Lập CT", color: "warning" },
  "1": { label: "Đã ghi sổ", color: "success" },
  "0": { label: "Hủy", color: "default" },
};

export function HoaDonList(): JSX.Element {
  const { data, isLoading, isFetching, isError, error, refetch } =
    useHoaDonList();
  const del = useDeleteHoaDon();

  const rows = useMemo(() => data ?? [], [data]);
  const list = useCatalogList<HoaDon>({
    rows,
    getId: (r) => r.stt_rec,
    searchKeys: SEARCH_KEYS,
  });
  const { selected, setSelected } = list;

  const [form, setForm] = useState<{
    open: boolean;
    mode: HoaDonMode;
    current: HoaDon | null;
  }>({
    open: false,
    mode: "new",
    current: null,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openForm = (mode: HoaDonMode, current: HoaDon | null) =>
    setForm({ open: true, mode, current });

  function confirmDelete() {
    if (!selected) return;
    list.setActionError("");
    del.mutate(selected.stt_rec, {
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
        addLabel="Thêm hóa đơn"
        onAdd={() => openForm("new", null)}
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Tìm số CT / mã-tên khách / diễn giải…"
        onRefresh={() => void refetch()}
        actions={[
          {
            title: "Sửa",
            icon: <EditIcon fontSize="small" />,
            disabled: !selected,
            onClick: () => selected && openForm("edit", selected),
          },
          {
            title: "Xem",
            icon: <VisibilityIcon fontSize="small" />,
            disabled: !selected,
            onClick: () => selected && openForm("view", selected),
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

      <Stack
        direction="row"
        sx={{ alignItems: "center", px: 2, py: 0.5, gap: 1 }}
      >
        <Typography variant="body2" color="text.secondary">
          Hóa đơn bán hàng
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: "auto" }}
        >
          {isLoading ? "đang tải…" : `${list.filtered.length} hóa đơn`}
          {isFetching && !isLoading ? " · đang cập nhật…" : ""}
        </Typography>
      </Stack>

      {(isError || list.actionError) && (
        <Alert severity="error" sx={{ mx: 2, mb: 1, py: 0 }}>
          {list.actionError || getApiError(error, "Không tải được danh sách.")}
        </Alert>
      )}

      <TableContainer sx={{ flex: 1, minHeight: 0 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell align="center">Đơn vị</TableCell>
              <TableCell>Ngày hạch toán</TableCell>
              <TableCell>Số chứng từ</TableCell>
              <TableCell>Mã khách</TableCell>
              <TableCell>Tên khách</TableCell>
              <TableCell>Diễn giải</TableCell>
              <TableCell align="right">Tiền hàng</TableCell>
              <TableCell align="right">Chiết khấu</TableCell>
              <TableCell align="right">Thuế</TableCell>
              <TableCell align="right">Thanh toán</TableCell>
              <TableCell align="center">Mã nt</TableCell>
              <TableCell align="center">Trạng thái</TableCell>
              <TableCell>Người lập</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={13}
                  align="center"
                  sx={{ py: 4, color: "text.secondary" }}
                >
                  Đang tải…
                </TableCell>
              </TableRow>
            )}
            {list.paged.map((r) => {
              const st = STATUS[r.status] ?? {
                label: r.status,
                color: "default" as const,
              };
              return (
                <TableRow
                  key={r.stt_rec}
                  hover
                  selected={list.isSelected(r)}
                  onClick={() => list.toggleSelect(r)}
                  onDoubleClick={() => openForm("edit", r)}
                  sx={{
                    cursor: "pointer",
                    opacity: r.status === "0" ? 0.55 : 1,
                  }}
                >
                  <TableCell align="center">{r.ma_dvcs || "—"}</TableCell>
                  <TableCell>{day(r.ngay_ct)}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{r.so_ct}</TableCell>
                  <TableCell>{r.ma_kh}</TableCell>
                  <TableCell>{r.ten_kh}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>
                    {r.dien_giai || "—"}
                  </TableCell>
                  <TableCell align="right">{money(r.t_tien_nt2)}</TableCell>
                  <TableCell align="right">{money(r.t_ck_nt)}</TableCell>
                  <TableCell align="right">{money(r.t_thue_nt)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {money(r.t_tt_nt)}
                  </TableCell>
                  <TableCell align="center">{r.ma_nt}</TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={st.label}
                      color={st.color}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>
                    {r.user_id0 || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && list.filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={13}
                  align="center"
                  sx={{ py: 6, color: "text.secondary" }}
                >
                  {list.searchInput
                    ? "Không tìm thấy hóa đơn phù hợp"
                    : "Chưa có hóa đơn nào"}
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

      <HoaDonFormDialog
        open={form.open}
        mode={form.mode}
        current={form.current}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa hóa đơn"
        message={
          selected
            ? `Bạn có chắc chắn muốn xóa hóa đơn số "${selected.so_ct}" của khách "${selected.ten_kh}"? Hành động này không thể hoàn tác.`
            : ""
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </Box>
  );
}

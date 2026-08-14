import { useMemo, useState, type JSX } from "react";
import {
  Alert,
  Box,
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
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import VisibilityIcon from "@mui/icons-material/Visibility";
import GridOnIcon from "@mui/icons-material/GridOn";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import LockIcon from "@mui/icons-material/Lock";
import { getApiError } from "@/lib/apiClient";
import DeleteDialog from "@/components/Accounting/DeleteDialog";
import { CatalogToolbar } from "@/components/Accounting/catalog/CatalogToolbar";
import { useCatalogList } from "@/components/Accounting/catalog/useCatalogList";
import {
  useDeleteHangHoa,
  useHangHoaList,
} from "@/features/accounting/ton_kho/danh_muc/hang_hoa/hooks/useHangHoa";
import {
  GIA_TON,
  type HangHoa,
} from "@/features/accounting/ton_kho/danh_muc/hang_hoa/types";
import { HangHoaFormDialog, type FormMode } from "./HangHoaFormDialog";
import { DoiMaDialog } from "./DoiMaDialog";

const SEARCH_KEYS = ["ma_vt", "ten_vt"];
const giaTon = (v: number): string => GIA_TON[v] ?? String(v);

export function HangHoaList(): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useHangHoaList({
    limit: 500,
  });
  const del = useDeleteHangHoa();

  const rows = useMemo(() => data?.data ?? [], [data]);
  const list = useCatalogList<HangHoa>({
    rows,
    getId: (r) => r.ma_vt,
    searchKeys: SEARCH_KEYS,
  });
  const { selected, setSelected } = list;

  const [form, setForm] = useState<{
    open: boolean;
    mode: FormMode;
    maVt: string | null;
  }>({
    open: false,
    mode: "new",
    maVt: null,
  });
  const [doiMa, setDoiMa] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openForm = (mode: FormMode, maVt: string | null) =>
    setForm({ open: true, mode, maVt });

  function confirmDelete() {
    if (!selected) return;
    list.setActionError("");
    del.mutate(selected.ma_vt, {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelected(null);
      },
      onError: (err) => list.setActionError(getApiError(err, "Xóa thất bại.")),
    });
  }

  const noop = () => {};

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
        addLabel="Thêm hàng hóa"
        onAdd={() => openForm("new", null)}
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Tìm mã / tên hàng…"
        onRefresh={() => void refetch()}
        actions={[
          {
            title: "Sửa",
            icon: <EditIcon fontSize="small" />,
            disabled: !selected,
            onClick: () => selected && openForm("edit", selected.ma_vt),
          },
          {
            title: "Copy",
            icon: <ContentCopyIcon fontSize="small" />,
            disabled: !selected,
            onClick: () => selected && openForm("copy", selected.ma_vt),
          },
          {
            title: "Xem",
            icon: <VisibilityIcon fontSize="small" />,
            disabled: !selected,
            onClick: () => selected && openForm("view", selected.ma_vt),
          },
          {
            title: "Đổi mã",
            icon: <SwapHorizIcon fontSize="small" />,
            disabled: !selected,
            onClick: () => selected && setDoiMa(selected.ma_vt),
          },
          {
            title: "Xóa",
            icon: <DeleteIcon fontSize="small" />,
            disabled: !selected,
            color: "error",
            onClick: () => setDeleteOpen(true),
          },
        ]}
        moreItems={[
          {
            icon: <GridOnIcon fontSize="small" />,
            label: "Xuất Excel",
            onClick: noop,
          },
          {
            icon: <UploadFileIcon fontSize="small" />,
            label: "Lấy dữ liệu từ tệp…",
            onClick: noop,
          },
          {
            icon: <FileDownloadIcon fontSize="small" />,
            label: "Tải tệp mẫu…",
            onClick: noop,
          },
          {
            icon: <LockIcon fontSize="small" />,
            label: "Khóa cột",
            onClick: noop,
          },
        ]}
      />

      {/* Info bar */}
      <Stack
        direction="row"
        sx={{ alignItems: "center", px: 2, py: 0.5, gap: 1 }}
      >
        <Typography variant="body2" color="text.secondary">
          Danh mục hàng hóa, vật tư
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: "auto" }}
        >
          {isLoading ? "đang tải…" : `${list.filtered.length} mặt hàng`}
        </Typography>
      </Stack>

      {(isError || list.actionError) && (
        <Alert severity="error" sx={{ mx: 2, mb: 1, py: 0 }}>
          {list.actionError || getApiError(error, "Không tải được danh sách.")}
        </Alert>
      )}

      {/* Table */}
      <TableContainer sx={{ flex: 1, minHeight: 0 }}>
        <Table
          size="small"
          stickyHeader
          sx={{ "& td, & th": { whiteSpace: "nowrap" } }}
        >
          <TableHead>
            <TableRow>
              <TableCell>Mã hàng</TableCell>
              <TableCell>Tên mặt hàng</TableCell>
              <TableCell>Đvt2</TableCell>
              <TableCell>Đvt</TableCell>
              <TableCell align="right">Hệ số</TableCell>
              <TableCell>Loại</TableCell>
              <TableCell>Phương pháp tính giá</TableCell>
              <TableCell>Tài khoản kho</TableCell>
              <TableCell>Tài khoản doanh thu</TableCell>
              <TableCell>Tài khoản doanh thu Nội bộ</TableCell>
              <TableCell>Tài khoản hàng bán bị trả lại</TableCell>
              <TableCell>Tài khoản giá vốn</TableCell>
              <TableCell>Tài khoản Khuyến mại</TableCell>
              <TableCell>Tài khoản chênh lệch giá vốn</TableCell>
              <TableCell>Kho Hàng</TableCell>
              <TableCell>Nhóm 1</TableCell>
              <TableCell>Nhóm 2</TableCell>
              <TableCell>Nhóm 3</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.paged.map((r) => (
              <TableRow
                key={r.ma_vt}
                hover
                selected={list.isSelected(r)}
                onClick={() => list.toggleSelect(r)}
                onDoubleClick={() => openForm("edit", r.ma_vt)}
                sx={{ cursor: "pointer", opacity: r.status === "0" ? 0.55 : 1 }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{r.ma_vt}</TableCell>
                <TableCell>{r.ten_vt}</TableCell>
                <TableCell>{r.dvt2 || "—"}</TableCell>
                <TableCell>{r.dvt}</TableCell>
                <TableCell align="right">
                  {r.dvt2 ? String(r.he_so2) : "—"}
                </TableCell>
                <TableCell>{r.loai_vt || "—"}</TableCell>
                <TableCell>{giaTon(Number(r.gia_ton))}</TableCell>
                <TableCell>{r.tk_vt || "—"}</TableCell>
                <TableCell>{r.tk_dt || "—"}</TableCell>
                <TableCell>{r.tk_dtnb || "—"}</TableCell>
                <TableCell>{r.tk_tl || "—"}</TableCell>
                <TableCell>{r.tk_gv || "—"}</TableCell>
                <TableCell>{r.tk_cpbh || "—"}</TableCell>
                <TableCell>{r.tk_cl_vt || "—"}</TableCell>
                <TableCell>{r.ma_kho || "—"}</TableCell>
                <TableCell>{r.nh_vt1 || "—"}</TableCell>
                <TableCell>{r.nh_vt2 || "—"}</TableCell>
                <TableCell>{r.nh_vt3 || "—"}</TableCell>
              </TableRow>
            ))}
            {!isLoading && list.filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={18}
                  align="center"
                  sx={{ py: 6, color: "text.secondary" }}
                >
                  {list.searchInput
                    ? "Không tìm thấy hàng hóa phù hợp"
                    : "Chưa có hàng hóa nào"}
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

      {/* Drawer form + dialogs */}
      <HangHoaFormDialog
        open={form.open}
        mode={form.mode}
        maVt={form.maVt}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onEdit={() => setForm((f) => ({ ...f, mode: "edit" }))}
      />
      <DoiMaDialog
        open={doiMa !== null}
        maCu={doiMa ?? ""}
        onClose={() => setDoiMa(null)}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa mã hàng"
        message={
          selected
            ? `Bạn có chắc chắn muốn xóa mã hàng "${selected.ma_vt} - ${selected.ten_vt}"? Hành động này không thể hoàn tác.`
            : ""
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </Box>
  );
}

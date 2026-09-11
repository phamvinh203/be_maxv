import { useEffect, useState, type JSX } from 'react';
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
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import { getApiError } from '@/lib/apiClient';
import DeleteDialog from '@/components/DeleteDialog';
import { CatalogToolbar } from '@/components/catalog/CatalogToolbar';
import {
  useDeleteKhachHang,
  useKhachHangList,
} from '@/features/ban_hang/danh_muc/dm_KH/hooks/useKhachHang';
import type { KhachHang } from '@/features/ban_hang/danh_muc/dm_KH/types';
import { KhachHangFormDialog, type KhachHangMode } from './KhachHangFormDialog';

/** Chờ người dùng ngừng gõ bao lâu rồi mới gửi từ khóa tìm kiếm lên server. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Danh mục khách hàng — PHÂN TRANG + TÌM KIẾM Ở SERVER (danh mục có thể rất lớn): chỉ trang đang xem đi
 * qua mạng, `total` do server đếm.
 */
export function KhachHangList(): JSX.Element {
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);
  const [selected, setSelected] = useState<KhachHang | null>(null);
  const [actionError, setActionError] = useState('');

  // Ngừng gõ một nhịp mới gửi từ khóa, và về trang đầu.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetching, isError, error, refetch } = useKhachHangList({
    page: page + 1,
    pageSize: rpp,
    q,
  });
  const del = useDeleteKhachHang();

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const isSelected = (r: KhachHang): boolean => selected?.ma_kh === r.ma_kh;
  const toggleSelect = (r: KhachHang): void =>
    setSelected((cur) => (cur?.ma_kh === r.ma_kh ? null : r));

  const [form, setForm] = useState<{ open: boolean; mode: KhachHangMode; current: KhachHang | null }>({
    open: false,
    mode: 'new',
    current: null,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openForm = (mode: KhachHangMode, current: KhachHang | null) =>
    setForm({ open: true, mode, current });

  function confirmDelete() {
    if (!selected) return;
    setActionError('');
    del.mutate(selected.ma_kh, {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelected(null);
        // Vừa xóa dòng cuối cùng của trang (không phải trang đầu) -> lùi một trang, khỏi hiện trang rỗng.
        if (rows.length === 1 && page > 0) setPage(page - 1);
      },
      onError: (err) => setActionError(getApiError(err, 'Xóa thất bại.')),
    });
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      <CatalogToolbar
        addLabel="Thêm khách hàng"
        onAdd={() => openForm('new', null)}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Tìm mã / tên / MST khách hàng…"
        onRefresh={() => void refetch()}
        actions={[
          { title: 'Sửa', icon: <EditIcon fontSize="small" />, disabled: !selected, onClick: () => selected && openForm('edit', selected) },
          { title: 'Copy', icon: <ContentCopyIcon fontSize="small" />, disabled: !selected, onClick: () => selected && openForm('copy', selected) },
          { title: 'Xóa', icon: <DeleteIcon fontSize="small" />, disabled: !selected, color: 'error', onClick: () => setDeleteOpen(true) },
        ]}
      />

      {/* Info bar */}
      <Stack direction="row" sx={{ alignItems: 'center', px: 2, py: 0.5, gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Danh mục khách hàng
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {isLoading ? 'đang tải…' : `${total} khách hàng`}
          {isFetching && !isLoading ? ' · đang cập nhật…' : ''}
        </Typography>
      </Stack>

      {(isError || actionError) && (
        <Alert severity="error" sx={{ mx: 2, mb: 1, py: 0 }}>
          {actionError || getApiError(error, 'Không tải được danh sách.')}
        </Alert>
      )}

      {/* Table */}
      <TableContainer sx={{ flex: 1, minHeight: 0 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Mã KH</TableCell>
              <TableCell>Tên khách hàng</TableCell>
              <TableCell>Địa chỉ</TableCell>
              <TableCell>Mã số thuế</TableCell>
              <TableCell align="center">Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Đang tải…
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow
                key={r.ma_kh}
                hover
                selected={isSelected(r)}
                onClick={() => toggleSelect(r)}
                onDoubleClick={() => openForm('edit', r)}
                sx={{ cursor: 'pointer', opacity: r.status === '0' ? 0.55 : 1 }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{r.ma_kh}</TableCell>
                <TableCell>{r.ten_kh}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{r.dia_chi || '—'}</TableCell>
                <TableCell>{r.ma_so_thue || '—'}</TableCell>
                <TableCell align="center">
                  <Chip
                    size="small"
                    label={r.status === '1' ? 'Đang dùng' : 'Ngừng'}
                    color={r.status === '1' ? 'success' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  {q ? 'Không tìm thấy khách hàng phù hợp' : 'Chưa có khách hàng nào'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rpp}
        onRowsPerPageChange={(e) => {
          setRpp(Number(e.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={[25, 50, 100]}
        labelRowsPerPage="Số dòng/trang"
      />

      {/* Dialogs */}
      <KhachHangFormDialog
        open={form.open}
        mode={form.mode}
        current={form.current}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa khách hàng"
        message={
          selected
            ? `Bạn có chắc chắn muốn xóa khách hàng "${selected.ma_kh} - ${selected.ten_kh}"? Hành động này không thể hoàn tác.`
            : ''
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </Box>
  );
}

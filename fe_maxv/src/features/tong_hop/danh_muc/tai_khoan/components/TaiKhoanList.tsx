import { useMemo, useState, type JSX } from 'react';
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
import { useCatalogList } from '@/components/catalog/useCatalogList';
import {
  useDeleteTaiKhoan,
  useTaiKhoanList,
} from '@/features/tong_hop/danh_muc/tai_khoan/hooks/useTaiKhoan';
import type { TaiKhoan } from '@/features/tong_hop/danh_muc/tai_khoan/types';
import { TaiKhoanFormDialog, type TaiKhoanMode } from './TaiKhoanFormDialog';

const SEARCH_KEYS = ['tk', 'ten_tk'];

export function TaiKhoanList(): JSX.Element {
  const { data, isLoading, isFetching, isError, error, refetch } = useTaiKhoanList();
  const del = useDeleteTaiKhoan();

  const rows = useMemo(() => data ?? [], [data]);
  const list = useCatalogList<TaiKhoan>({
    rows,
    getId: (r) => r.tk,
    searchKeys: SEARCH_KEYS,
  });
  const { selected, setSelected } = list;

  const [form, setForm] = useState<{ open: boolean; mode: TaiKhoanMode; current: TaiKhoan | null }>({
    open: false,
    mode: 'new',
    current: null,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openForm = (mode: TaiKhoanMode, current: TaiKhoan | null) =>
    setForm({ open: true, mode, current });

  function confirmDelete() {
    if (!selected) return;
    list.setActionError('');
    del.mutate(selected.tk, {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelected(null);
      },
      onError: (err) => list.setActionError(getApiError(err, 'Xóa thất bại.')),
    });
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      <CatalogToolbar
        addLabel="Thêm tài khoản"
        onAdd={() => openForm('new', null)}
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Tìm số / tên tài khoản…"
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
          Danh mục tài khoản
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {isLoading ? 'đang tải…' : `${list.filtered.length} tài khoản`}
          {isFetching && !isLoading ? ' · đang cập nhật…' : ''}
        </Typography>
      </Stack>

      {(isError || list.actionError) && (
        <Alert severity="error" sx={{ mx: 2, mb: 1, py: 0 }}>
          {list.actionError || getApiError(error, 'Không tải được danh sách.')}
        </Alert>
      )}

      {/* Table */}
      <TableContainer sx={{ flex: 1, minHeight: 0 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Tài khoản</TableCell>
              <TableCell>Tên tài khoản</TableCell>
              <TableCell>TK mẹ</TableCell>
              <TableCell align="center">NT</TableCell>
              <TableCell align="center">Công nợ</TableCell>
              <TableCell align="center">Sổ cái</TableCell>
              <TableCell align="right">Bậc</TableCell>
              <TableCell align="center">Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Đang tải…
                </TableCell>
              </TableRow>
            )}
            {list.paged.map((r) => {
              const level = Math.max(0, (r.bac_tk ?? 1) - 1);
              const isTopLevel = r.bac_tk === 1;
              return (
                <TableRow
                  key={r.tk}
                  hover
                  selected={list.isSelected(r)}
                  onClick={() => list.toggleSelect(r)}
                  onDoubleClick={() => openForm('edit', r)}
                  sx={{
                    cursor: 'pointer',
                    opacity: r.status === '0' ? 0.55 : 1,
                    ...(isTopLevel && {
                      bgcolor: 'action.selected',
                      '& > .MuiTableCell-root': { fontWeight: 700 },
                    }),
                  }}
                >
                  <TableCell sx={{ fontWeight: 600, pl: `${16 + level * 20}px` }}>{r.tk}</TableCell>
                  <TableCell>{r.ten_tk}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{r.tk_me || '—'}</TableCell>
                  <TableCell align="center">{r.ma_nt || '—'}</TableCell>
                  <TableCell align="center">{r.tk_cn === '1' ? '✓' : ''}</TableCell>
                  <TableCell align="center">{r.tk_sc === '1' ? '✓' : ''}</TableCell>
                  <TableCell align="right">{r.bac_tk ?? '—'}</TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={r.status === '1' ? 'Theo dõi' : 'Ngừng'}
                      color={r.status === '1' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && list.filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  {list.searchInput ? 'Không tìm thấy tài khoản phù hợp' : 'Chưa có tài khoản nào'}
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
      <TaiKhoanFormDialog
        open={form.open}
        mode={form.mode}
        current={form.current}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa tài khoản"
        message={
          selected
            ? `Bạn có chắc chắn muốn xóa tài khoản "${selected.tk} - ${selected.ten_tk}"? Hành động này không thể hoàn tác.`
            : ''
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </Box>
  );
}

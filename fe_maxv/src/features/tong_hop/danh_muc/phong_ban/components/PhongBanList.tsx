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
  useDeletePhongBan,
  usePhongBanList,
} from '@/features/tong_hop/danh_muc/phong_ban/hooks/usePhongBan';
import type { PhongBan } from '@/features/tong_hop/danh_muc/phong_ban/types';
import { PhongBanFormDialog, type PhongBanMode } from './PhongBanFormDialog';

const SEARCH_KEYS = ['ma_pb', 'ten_pb'];

export function PhongBanList(): JSX.Element {
  const { data, isLoading, isFetching, isError, error, refetch } = usePhongBanList();
  const del = useDeletePhongBan();

  const rows = useMemo(() => data ?? [], [data]);
  const list = useCatalogList<PhongBan>({
    rows,
    getId: (r) => r.ma_pb,
    searchKeys: SEARCH_KEYS,
  });
  const { selected, setSelected } = list;

  const [form, setForm] = useState<{ open: boolean; mode: PhongBanMode; current: PhongBan | null }>({
    open: false,
    mode: 'new',
    current: null,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openForm = (mode: PhongBanMode, current: PhongBan | null) =>
    setForm({ open: true, mode, current });

  function confirmDelete() {
    if (!selected) return;
    list.setActionError('');
    del.mutate(selected.ma_pb, {
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
        addLabel="Thêm phòng ban"
        onAdd={() => openForm('new', null)}
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Tìm mã / tên phòng ban…"
        onRefresh={() => void refetch()}
        actions={[
          { title: 'Sửa', icon: <EditIcon fontSize="small" />, disabled: !selected, onClick: () => selected && openForm('edit', selected) },
          { title: 'Copy', icon: <ContentCopyIcon fontSize="small" />, disabled: !selected, onClick: () => selected && openForm('copy', selected) },
          { title: 'Xóa', icon: <DeleteIcon fontSize="small" />, disabled: !selected, color: 'error', onClick: () => setDeleteOpen(true) },
        ]}
      />

      <Stack direction="row" sx={{ alignItems: 'center', px: 2, py: 0.5, gap: 1 }}>
        <Typography variant="body2" color="text.secondary">Danh mục phòng ban</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {isLoading ? 'đang tải…' : `${list.filtered.length} phòng ban`}
          {isFetching && !isLoading ? ' · đang cập nhật…' : ''}
        </Typography>
      </Stack>

      {(isError || list.actionError) && (
        <Alert severity="error" sx={{ mx: 2, mb: 1, py: 0 }}>
          {list.actionError || getApiError(error, 'Không tải được danh sách.')}
        </Alert>
      )}

      <TableContainer sx={{ flex: 1, minHeight: 0 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Mã phòng ban</TableCell>
              <TableCell>Tên phòng ban</TableCell>
              <TableCell>Địa chỉ</TableCell>
              <TableCell>Điện thoại</TableCell>
              <TableCell>Tk chi phí</TableCell>
              <TableCell align="center">Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>Đang tải…</TableCell>
              </TableRow>
            )}
            {list.paged.map((r) => (
              <TableRow
                key={r.ma_pb}
                hover
                selected={list.isSelected(r)}
                onClick={() => list.toggleSelect(r)}
                onDoubleClick={() => openForm('edit', r)}
                sx={{ cursor: 'pointer', opacity: r.status === '0' ? 0.55 : 1 }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{r.ma_pb}</TableCell>
                <TableCell>{r.ten_pb}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{r.dia_chi || '—'}</TableCell>
                <TableCell>{r.dien_thoai || '—'}</TableCell>
                <TableCell>{r.ma_td1 || '—'}</TableCell>
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
            {!isLoading && list.filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  {list.searchInput ? 'Không tìm thấy phòng ban phù hợp' : 'Chưa có phòng ban nào'}
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

      <PhongBanFormDialog
        open={form.open}
        mode={form.mode}
        current={form.current}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa phòng ban"
        message={
          selected
            ? `Bạn có chắc chắn muốn xóa phòng ban "${selected.ma_pb} - ${selected.ten_pb}"? Hành động này không thể hoàn tác.`
            : ''
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </Box>
  );
}

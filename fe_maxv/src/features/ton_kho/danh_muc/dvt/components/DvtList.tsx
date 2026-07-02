import { useEffect, useMemo, useState, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { getApiError } from '@/lib/apiClient';
import {
  useDeleteDvt,
  useDvtList,
} from '@/features/ton_kho/danh_muc/dvt/hooks/useDvt';
import type { Dvt } from '@/features/ton_kho/danh_muc/dvt/types';
import DeleteDialog from '@/components/DeleteDialog';
import { DvtFormDialog, type DvtMode } from './DvtFormDialog';

export function DvtList(): JSX.Element {
  const { data, isLoading, isFetching, isError, error, refetch } = useDvtList();
  const del = useDeleteDvt();

  const [selected, setSelected] = useState<Dvt | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);

  const [form, setForm] = useState<{ open: boolean; mode: DvtMode; current: Dvt | null }>({
    open: false,
    mode: 'new',
    current: null,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim().toLowerCase());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const allRows = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => {
    if (!search) return allRows;
    return allRows.filter(
      (r) =>
        r.dvt.toLowerCase().includes(search) ||
        r.ten_dvt.toLowerCase().includes(search),
    );
  }, [allRows, search]);

  const paged = useMemo(
    () => rows.slice(page * rpp, page * rpp + rpp),
    [rows, page, rpp],
  );

  const sel = selected;
  const openForm = (mode: DvtMode, current: Dvt | null) =>
    setForm({ open: true, mode, current });

  function confirmDelete() {
    if (!sel) return;
    setActionError('');
    del.mutate(sel.dvt, {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelected(null);
      },
      onError: (err) => setActionError(getApiError(err, 'Xóa thất bại.')),
    });
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      {/* Toolbar */}
      <Paper
        elevation={0}
        square
        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}
      >
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openForm('new', null)}>
          Thêm đơn vị tính
        </Button>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tooltip title="Sửa">
          <span>
            <IconButton size="small" disabled={!sel} onClick={() => sel && openForm('edit', sel)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Copy">
          <span>
            <IconButton size="small" disabled={!sel} onClick={() => sel && openForm('copy', sel)}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Xóa">
          <span>
            <IconButton size="small" color="error" disabled={!sel} onClick={() => setDeleteOpen(true)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        <TextField
          size="small"
          placeholder="Tìm mã / tên ĐVT…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ minWidth: 220 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Tooltip title="Làm tươi">
          <IconButton size="small" onClick={() => void refetch()}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>

      {/* Info bar */}
      <Stack direction="row" sx={{ alignItems: 'center', px: 2, py: 0.5, gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Danh mục đơn vị tính
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {isLoading ? 'đang tải…' : `${rows.length} đơn vị`}
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
              <TableCell>Mã ĐVT</TableCell>
              <TableCell>ĐVT 2</TableCell>
              <TableCell>Tên đơn vị tính</TableCell>
              <TableCell>Tên khác</TableCell>
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
            {paged.map((r) => {
              const isSel = sel?.dvt === r.dvt;
              return (
                <TableRow
                  key={r.dvt}
                  hover
                  selected={isSel}
                  onClick={() => setSelected(isSel ? null : r)}
                  onDoubleClick={() => openForm('edit', r)}
                  sx={{ cursor: 'pointer', opacity: r.status === '0' ? 0.55 : 1 }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>{r.dvt}</TableCell>
                  <TableCell>{r.dvt2 || '—'}</TableCell>
                  <TableCell>{r.ten_dvt}</TableCell>
                  <TableCell>{r.ten_dvt2 || '—'}</TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={r.status === '1' ? 'Đang dùng' : 'Ngừng'}
                      color={r.status === '1' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  {search ? 'Không tìm thấy đơn vị tính phù hợp' : 'Chưa có đơn vị tính nào'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={rows.length}
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
          sel
            ? `Bạn có chắc chắn muốn xóa đơn vị tính "${sel.dvt} - ${sel.ten_dvt}"? Hành động này không thể hoàn tác.`
            : ''
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </Box>
  );
}

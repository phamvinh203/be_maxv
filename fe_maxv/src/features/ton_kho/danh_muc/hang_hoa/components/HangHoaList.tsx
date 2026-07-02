import { useEffect, useMemo, useState, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
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
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import GridOnIcon from '@mui/icons-material/GridOn';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LockIcon from '@mui/icons-material/Lock';
import { getApiError } from '@/lib/apiClient';
import {
  useDeleteHangHoa,
  useHangHoaList,
} from '@/features/ton_kho/danh_muc/hang_hoa/hooks/useHangHoa';
import { GIA_TON, type HangHoa } from '@/features/ton_kho/danh_muc/hang_hoa/types';
import DeleteDialog from '@/components/DeleteDialog';
import { HangHoaFormDialog, type FormMode } from './HangHoaFormDialog';
import { DoiMaDialog } from './DoiMaDialog';

const giaTon = (v: number): string => GIA_TON[v] ?? String(v);

export function HangHoaList(): JSX.Element {
  const { data, isLoading, isError, error, refetch } =
    useHangHoaList({ limit: 500 });
  const del = useDeleteHangHoa();

  const [selected, setSelected] = useState<HangHoa | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);
  const [moreEl, setMoreEl] = useState<null | HTMLElement>(null);

  const [form, setForm] = useState<{ open: boolean; mode: FormMode; maVt: string | null }>({
    open: false,
    mode: 'new',
    maVt: null,
  });
  const [doiMa, setDoiMa] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim().toLowerCase());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const allRows = useMemo(() => data?.data ?? [], [data]);
  const rows = useMemo(() => {
    if (!search) return allRows;
    return allRows.filter(
      (r) =>
        r.ma_vt.toLowerCase().includes(search) ||
        r.ten_vt.toLowerCase().includes(search),
    );
  }, [allRows, search]);

  const paged = useMemo(
    () => rows.slice(page * rpp, page * rpp + rpp),
    [rows, page, rpp],
  );

  const sel = selected;
  const openForm = (mode: FormMode, maVt: string | null) =>
    setForm({ open: true, mode, maVt });

  function confirmDelete() {
    if (!sel) return;
    setActionError('');
    del.mutate(sel.ma_vt, {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelected(null);
      },
      onError: (err) => setActionError(getApiError(err, 'Xóa thất bại.')),
    });
  }

  const closeMore = () => setMoreEl(null);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      {/* Toolbar */}
      <Paper
        elevation={0}
        square
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          flexWrap: 'wrap',
        }}
      >
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openForm('new', null)}>
          Thêm hàng hóa
        </Button>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Sửa">
          <span>
            <IconButton size="small" disabled={!sel} onClick={() => sel && openForm('edit', sel.ma_vt)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Copy">
          <span>
            <IconButton size="small" disabled={!sel} onClick={() => sel && openForm('copy', sel.ma_vt)}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Xem">
          <span>
            <IconButton size="small" disabled={!sel} onClick={() => sel && openForm('view', sel.ma_vt)}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Đổi mã">
          <span>
            <IconButton size="small" disabled={!sel} onClick={() => sel && setDoiMa(sel.ma_vt)}>
              <SwapHorizIcon fontSize="small" />
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
          placeholder="Tìm mã / tên hàng…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ minWidth: 240 }}
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
        <Tooltip title="Thêm thao tác">
          <IconButton size="small" onClick={(e) => setMoreEl(e.currentTarget)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={moreEl} open={!!moreEl} onClose={closeMore}>
          <MenuItem onClick={closeMore}><GridOnIcon fontSize="small" sx={{ mr: 1 }} />Xuất Excel</MenuItem>
          <MenuItem onClick={closeMore}><UploadFileIcon fontSize="small" sx={{ mr: 1 }} />Lấy dữ liệu từ tệp…</MenuItem>
          <MenuItem onClick={closeMore}><FileDownloadIcon fontSize="small" sx={{ mr: 1 }} />Tải tệp mẫu…</MenuItem>
          <MenuItem onClick={closeMore}><LockIcon fontSize="small" sx={{ mr: 1 }} />Khóa cột</MenuItem>
        </Menu>
      </Paper>

      {/* Info bar */}
      <Stack direction="row" sx={{ alignItems: 'center', px: 2, py: 0.5, gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Danh mục hàng hóa, vật tư
        </Typography>
        
      </Stack>

      {(isError || actionError) && (
        <Alert severity="error" sx={{ mx: 2, mb: 1, py: 0 }}>
          {actionError || getApiError(error, 'Không tải được danh sách.')}
        </Alert>
      )}

      {/* Table */}
      <TableContainer sx={{ flex: 1, minHeight: 0 }}>
        <Table
          size="small"
          stickyHeader
          sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}
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
            {paged.map((r) => {
              const isSel = sel?.ma_vt === r.ma_vt;
              return (
                <TableRow
                  key={r.ma_vt}
                  hover
                  selected={isSel}
                  onClick={() => setSelected(isSel ? null : r)}
                  onDoubleClick={() => openForm('edit', r.ma_vt)}
                  sx={{ cursor: 'pointer', opacity: r.status === '0' ? 0.55 : 1 }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>{r.ma_vt}</TableCell>
                  <TableCell>{r.ten_vt}</TableCell>
                  <TableCell>{r.dvt2 || '—'}</TableCell>
                  <TableCell>{r.dvt}</TableCell>
                  <TableCell align="right">{r.dvt2 ? String(r.he_so2) : '—'}</TableCell>
                  <TableCell>{r.loai_vt || '—'}</TableCell>
                  <TableCell>{giaTon(Number(r.gia_ton))}</TableCell>
                  <TableCell>{r.tk_vt || '—'}</TableCell>
                  <TableCell>{r.tk_dt || '—'}</TableCell>
                  <TableCell>{r.tk_dtnb || '—'}</TableCell>
                  <TableCell>{r.tk_tl || '—'}</TableCell>
                  <TableCell>{r.tk_gv || '—'}</TableCell>
                  <TableCell>{r.tk_cpbh || '—'}</TableCell>
                  <TableCell>{r.tk_cl_vt || '—'}</TableCell>
                  <TableCell>{r.ma_kho || '—'}</TableCell>
                  <TableCell>{r.nh_vt1 || '—'}</TableCell>
                  <TableCell>{r.nh_vt2 || '—'}</TableCell>
                  <TableCell>{r.nh_vt3 || '—'}</TableCell>
                </TableRow>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={18} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  {search ? 'Không tìm thấy hàng hóa phù hợp' : 'Chưa có hàng hóa nào'}
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

      {/* Drawer form + dialogs */}
      <HangHoaFormDialog
        open={form.open}
        mode={form.mode}
        maVt={form.maVt}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onEdit={() => setForm((f) => ({ ...f, mode: 'edit' }))}
      />
      <DoiMaDialog
        open={doiMa !== null}
        maCu={doiMa ?? ''}
        onClose={() => setDoiMa(null)}
      />
      <DeleteDialog
        open={deleteOpen}
        title="Xóa mã hàng"
        message={
          sel
            ? `Bạn có chắc chắn muốn xóa mã hàng "${sel.ma_vt} - ${sel.ten_vt}"? Hành động này không thể hoàn tác.`
            : ''
        }
        deleting={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </Box>
  );
}

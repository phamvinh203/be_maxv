import { useMemo, useState, type JSX } from 'react';
import {
  Alert,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { getApiError } from '@/lib/apiClient';
import { useKhachHangList } from '@/features/ban_hang/danh_muc/dm_KH/hooks/useKhachHang';
import type { KhachHang } from '@/features/ban_hang/danh_muc/dm_KH/types';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (kh: KhachHang) => void;
}

/** Dialog chọn 1 khách hàng (GET từ API khách hàng). */
export function KhachHangPickerDialog({
  open,
  title = 'Chọn khách hàng',
  onClose,
  onSelect,
}: Props): JSX.Element {
  const { data, isLoading, isError, error } = useKhachHangList();
  const [search, setSearch] = useState('');

  const rows = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.ma_kh.toLowerCase().includes(q) ||
        r.ten_kh.toLowerCase().includes(q) ||
        (r.ma_so_thue ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  function pick(r: KhachHang) {
    onSelect(r);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          size="small"
          autoFocus
          placeholder="Tìm mã / tên / MST khách hàng…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mb: 1.5 }}
        />

        {isError && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {getApiError(error, 'Không tải được danh sách khách hàng.')}
          </Alert>
        )}

        <TableContainer sx={{ maxHeight: 380 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 120 }}>Mã KH</TableCell>
                <TableCell>Tên khách hàng</TableCell>
                <TableCell sx={{ width: 130 }}>MST</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    Đang tải…
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow
                  key={r.ma_kh}
                  hover
                  onClick={() => pick(r)}
                  onDoubleClick={() => pick(r)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>{r.ma_kh}</TableCell>
                  <TableCell>{r.ten_kh}</TableCell>
                  <TableCell>{r.ma_so_thue || '—'}</TableCell>
                </TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {search ? 'Không tìm thấy khách hàng phù hợp' : 'Chưa có khách hàng nào'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Nhấp vào một dòng để chọn khách hàng.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

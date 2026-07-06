import { useEffect, useState, type JSX } from 'react';
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
import { useHangHoaList } from '@/features/ton_kho/danh_muc/hang_hoa/hooks/useHangHoa';
import type { HangHoa } from '@/features/ton_kho/danh_muc/hang_hoa/types';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (vt: HangHoa) => void;
}

/** Dialog chọn 1 hàng hóa, vật tư (danh mục hàng hóa) — tìm kiếm phía server. */
export function VatTuPickerDialog({
  open,
  title = 'Danh mục hàng hóa, vật tư',
  onClose,
  onSelect,
}: Props): JSX.Element {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, error } = useHangHoaList({
    search: debounced,
    limit: 50,
  });
  const rows = data?.data ?? [];

  function pick(r: HangHoa) {
    onSelect(r);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          size="small"
          autoFocus
          placeholder="Tìm mã / tên hàng hóa…"
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
            {getApiError(error, 'Không tải được danh sách hàng hóa.')}
          </Alert>
        )}

        <TableContainer sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 110 }}>Mã hàng</TableCell>
                <TableCell>Tên hàng</TableCell>
                <TableCell sx={{ width: 60 }} align="center">Đvt</TableCell>
                <TableCell sx={{ width: 90 }}>Tk vật tư</TableCell>
                <TableCell sx={{ width: 100 }}>TK doanh thu</TableCell>
                <TableCell sx={{ width: 100 }}>TK giá vốn</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    Đang tải…
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow
                  key={r.ma_vt}
                  hover
                  onClick={() => pick(r)}
                  onDoubleClick={() => pick(r)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>{r.ma_vt}</TableCell>
                  <TableCell>{r.ten_vt}</TableCell>
                  <TableCell align="center">{r.dvt}</TableCell>
                  <TableCell>{r.tk_vt || '—'}</TableCell>
                  <TableCell>{r.tk_dt || '—'}</TableCell>
                  <TableCell>{r.tk_gv || '—'}</TableCell>
                </TableRow>
              ))}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {debounced ? 'Không tìm thấy hàng hóa phù hợp' : 'Chưa có hàng hóa nào'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Nhấp vào một dòng để chọn hàng hóa.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

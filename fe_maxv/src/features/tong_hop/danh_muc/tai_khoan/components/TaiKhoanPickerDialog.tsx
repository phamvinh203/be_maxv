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
import { useTaiKhoanList } from '@/features/tong_hop/danh_muc/tai_khoan/hooks/useTaiKhoan';
import type { TaiKhoan } from '@/features/tong_hop/danh_muc/tai_khoan/types';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (tk: TaiKhoan) => void;
}

/** Dialog chọn 1 tài khoản (GET từ API tài khoản). Dùng cho các ô nhập TK. */
export function TaiKhoanPickerDialog({
  open,
  title = 'Chọn tài khoản',
  onClose,
  onSelect,
}: Props): JSX.Element {
  const { data, isLoading, isError, error } = useTaiKhoanList();
  const [search, setSearch] = useState('');

  const rows = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.tk.toLowerCase().includes(q) ||
        r.ten_tk.toLowerCase().includes(q),
    );
  }, [rows, search]);

  function pick(r: TaiKhoan) {
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
          placeholder="Tìm số / tên tài khoản…"
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
            {getApiError(error, 'Không tải được danh sách tài khoản.')}
          </Alert>
        )}

        <TableContainer sx={{ maxHeight: 380 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 120 }}>Tài khoản</TableCell>
                <TableCell>Tên tài khoản</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    Đang tải…
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const isTopLevel = r.bac_tk === 1;
                return (
                  <TableRow
                    key={r.tk}
                    hover
                    onClick={() => pick(r)}
                    onDoubleClick={() => pick(r)}
                    sx={{
                      cursor: 'pointer',
                      ...(isTopLevel && {
                        bgcolor: 'action.selected',
                        '& > .MuiTableCell-root': { fontWeight: 700 },
                      }),
                    }}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>{r.tk}</TableCell>
                    <TableCell>{r.ten_tk}</TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {search ? 'Không tìm thấy tài khoản phù hợp' : 'Chưa có tài khoản nào'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Nhấp vào một dòng để chọn tài khoản.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

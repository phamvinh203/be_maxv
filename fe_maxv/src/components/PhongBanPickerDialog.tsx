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
import { usePhongBanList } from '@/features/tong_hop/danh_muc/phong_ban/hooks/usePhongBan';
import type { PhongBan } from '@/features/tong_hop/danh_muc/phong_ban/types';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (pb: PhongBan) => void;
}

/** Dialog chọn 1 phòng ban (GET từ danh mục phòng ban) — hiện mã + tên. */
export function PhongBanPickerDialog({
  open,
  title = 'Chọn phòng ban',
  onClose,
  onSelect,
}: Props): JSX.Element {
  const { data, isLoading, isError, error } = usePhongBanList();
  const [search, setSearch] = useState('');

  const rows = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.ma_pb.toLowerCase().includes(q) || r.ten_pb.toLowerCase().includes(q),
    );
  }, [rows, search]);

  function pick(r: PhongBan) {
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
          placeholder="Tìm mã / tên phòng ban…"
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
            {getApiError(error, 'Không tải được danh sách phòng ban.')}
          </Alert>
        )}

        <TableContainer sx={{ maxHeight: 380 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 130 }}>Mã phòng ban</TableCell>
                <TableCell>Tên phòng ban</TableCell>
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
              {filtered.map((r) => (
                <TableRow
                  key={r.ma_pb}
                  hover
                  onClick={() => pick(r)}
                  onDoubleClick={() => pick(r)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>{r.ma_pb}</TableCell>
                  <TableCell>{r.ten_pb}</TableCell>
                </TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {search ? 'Không tìm thấy phòng ban phù hợp' : 'Chưa có phòng ban nào'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Nhấp vào một dòng để chọn phòng ban.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

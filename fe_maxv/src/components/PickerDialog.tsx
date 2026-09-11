import { useMemo, useState, type JSX, type ReactNode } from 'react';
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
  type SxProps,
  type Theme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { getApiError } from '@/lib/apiClient';

export interface PickerColumn<T> {
  label: string;
  render: (row: T) => ReactNode;
  width?: number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
}

interface Props<T> {
  open: boolean;
  title: string;
  /** Danh từ dùng cho placeholder/empty/error, VD "tài khoản". */
  noun: string;
  rows: T[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  columns: PickerColumn<T>[];
  getKey: (row: T) => string;
  /** So khớp 1 dòng với từ khóa (đã lowercase, đã trim) — lọc phía client. */
  filter?: (row: T, q: string) => boolean;
  /**
   * Tìm kiếm PHÍA SERVER (danh mục lớn, không tải cả bảng): có prop này thì dialog không tự lọc `rows`
   * mà báo từ khóa ra ngoài để nơi gọi nạp lại `rows` đã lọc.
   */
  onSearchChange?: (q: string) => void;
  /** Ghi chú dưới bảng, VD "Đang hiện 50/320 — gõ thêm để thu hẹp". */
  footerNote?: ReactNode;
  /** sx tùy dòng (VD tô đậm tài khoản bậc 1). */
  rowSx?: (row: T) => SxProps<Theme> | undefined;
  onClose: () => void;
  onSelect: (row: T) => void;
}

/**
 * Dialog chọn 1 bản ghi từ danh mục. Mặc định lọc phía client theo `filter`; truyền `onSearchChange` để
 * lọc phía server. Dùng chung cho mọi picker.
 */
export function PickerDialog<T>({
  open,
  title,
  noun,
  rows,
  isLoading,
  isError,
  error,
  columns,
  getKey,
  filter,
  onSearchChange,
  footerNote,
  rowSx,
  onClose,
  onSelect,
}: Props<T>): JSX.Element {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (onSearchChange || !filter || !q) return rows;
    return rows.filter((r) => filter(r, q));
  }, [rows, search, filter, onSearchChange]);

  const pick = (r: T) => {
    onSelect(r);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={columns.length > 3 ? 'md' : 'sm'}>
      <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          size="small"
          autoFocus
          placeholder={`Tìm ${noun}…`}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onSearchChange?.(e.target.value.trim());
          }}
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
            {getApiError(error, `Không tải được danh sách ${noun}.`)}
          </Alert>
        )}

        <TableContainer sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {columns.map((c, i) => (
                  <TableCell key={i} align={c.align} sx={c.width ? { width: c.width } : undefined}>
                    {c.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    Đang tải…
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow
                  key={getKey(r)}
                  hover
                  onClick={() => pick(r)}
                  onDoubleClick={() => pick(r)}
                  sx={{ cursor: 'pointer', ...rowSx?.(r) }}
                >
                  {columns.map((c, i) => (
                    <TableCell key={i} align={c.align} sx={c.bold ? { fontWeight: 600 } : undefined}>
                      {c.render(r)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {search ? `Không tìm thấy ${noun} phù hợp` : `Chưa có ${noun} nào`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Nhấp vào một dòng để chọn.
            {footerNote ? <> {footerNote}</> : null}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

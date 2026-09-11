import type { JSX } from 'react';
import {
  Alert,
  Box,
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
import { getApiError } from '@/lib/apiClient';
import {
  CatalogToolbar,
  type CatalogAction,
  type CatalogMoreItem,
} from './CatalogToolbar';
import type { CatalogColumn } from './catalogColumns';
import type { useCatalogList } from './useCatalogList';

type CatalogListState<T> = ReturnType<typeof useCatalogList<T>>;

interface Props<T extends { status: string }> {
  // Toolbar
  addLabel: string;
  onAdd: () => void;
  searchPlaceholder: string;
  actions: CatalogAction[];
  moreItems?: CatalogMoreItem[];
  onRefresh: () => void;
  // Info bar
  infoLabel: string;
  /** Hậu tố sau số dòng, VD "3 đơn vị". */
  countSuffix: string;
  // Bảng
  columns: CatalogColumn<T>[];
  getRowKey: (row: T) => string;
  onRowDoubleClick: (row: T) => void;
  notFoundLabel: string;
  emptyLabel: string;
  // Data
  list: CatalogListState<T>;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * RVW-TK-012: khung bảng danh mục dùng chung — Toolbar + info bar + Alert lỗi + bảng + phân
 * trang, giống hệt phần đã lặp lại ~1700 dòng ở Dvt/Kho/LoaiVt/MaGd/NhomKho/PhanNhom/ViTriKho.
 * FormDialog + DeleteDialog vẫn do từng màn tự render (khác nhau nhiều — số field, tham số
 * xóa 1-khóa/2-khóa —, không đáng gộp). HangHoaList KHÔNG dùng shell này — đã có server paging
 * riêng (RVW-TK-001), cấu trúc bảng khác hẳn (18 cột, không có ô Trạng thái riêng).
 */
export function CatalogTableShell<T extends { status: string }>({
  addLabel,
  onAdd,
  searchPlaceholder,
  actions,
  moreItems,
  onRefresh,
  infoLabel,
  countSuffix,
  columns,
  getRowKey,
  onRowDoubleClick,
  notFoundLabel,
  emptyLabel,
  list,
  isLoading,
  isFetching,
  isError,
  error,
}: Props<T>): JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.default',
      }}
    >
      <CatalogToolbar
        addLabel={addLabel}
        onAdd={onAdd}
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder={searchPlaceholder}
        onRefresh={onRefresh}
        actions={actions}
        moreItems={moreItems}
      />

      {/* Info bar */}
      <Stack direction="row" sx={{ alignItems: 'center', px: 2, py: 0.5, gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {infoLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {isLoading ? 'đang tải…' : `${list.filtered.length} ${countSuffix}`}
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
              {columns.map((c, i) => (
                <TableCell key={i} align={c.align}>
                  {c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Đang tải…
                </TableCell>
              </TableRow>
            )}
            {list.paged.map((r) => (
              <TableRow
                key={getRowKey(r)}
                hover
                selected={list.isSelected(r)}
                onClick={() => list.toggleSelect(r)}
                onDoubleClick={() => onRowDoubleClick(r)}
                sx={{ cursor: 'pointer', opacity: r.status === '0' ? 0.55 : 1 }}
              >
                {columns.map((c, i) => (
                  <TableCell key={i} align={c.align} sx={c.bold ? { fontWeight: 600 } : undefined}>
                    {c.render(r)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {!isLoading && list.filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  {list.searchInput ? notFoundLabel : emptyLabel}
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
    </Box>
  );
}

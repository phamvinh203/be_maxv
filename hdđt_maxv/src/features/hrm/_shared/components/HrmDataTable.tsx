import type { ReactNode } from "react";
import {
  DataGrid,
  GridFooterContainer,
  GridPagination,
  type GridColDef,
  type GridValidRowModel,
} from "@mui/x-data-grid";
import Box from "@mui/material/Box";
import AsyncState from "./AsyncState";

interface HrmDataTableProps<T extends GridValidRowModel> {
  rows: T[];
  columns: GridColDef<T>[];
  getRowId: (row: T) => string;
  /** Đang tải lần đầu — bọc cả bảng bằng AsyncState, KHÔNG chỉ phần thân. */
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  /** Tên field các cột dính trái, theo đúng thứ tự trong mảng `columns`. */
  pinnedLeftColumns?: string[];
  /** Nội dung tùy biến hiện dưới bảng, phía trên nút phân trang — vd dòng tổng cộng. */
  footer?: ReactNode;
  rowHeight?: number;
  pageSizeOptions?: number[];
  initialPageSize?: number;
}

function Footer({ content }: { content?: ReactNode }) {
  return (
    <GridFooterContainer>
      {content && (
        <Box sx={{ px: 2, py: 1, flexGrow: 1, overflow: "auto" }}>{content}</Box>
      )}
      <GridPagination />
    </GridFooterContainer>
  );
}

/**
 * Bảng dữ liệu dùng chung cho HRM — bọc `@mui/x-data-grid` (Community).
 *
 * Phân trang/sắp xếp là CLIENT-SIDE (be_maxv chưa hỗ trợ `skip`/`take` — ADR-011).
 * Không có tổng cột dính (pinned summary row) vì đó là tính năng Pro — dùng prop
 * `footer` để tự vẽ phần tổng theo cách phù hợp màn hình gọi.
 */
export default function HrmDataTable<T extends GridValidRowModel>({
  rows,
  columns,
  getRowId,
  loading = false,
  error = null,
  empty = false,
  emptyMessage,
  pinnedLeftColumns,
  footer,
  rowHeight = 52,
  pageSizeOptions = [10, 25, 50, 100],
  initialPageSize = 25,
}: HrmDataTableProps<T>) {
  return (
    <AsyncState loading={loading} error={error} empty={empty} emptyMessage={emptyMessage}>
      <Box sx={{ width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={getRowId}
          rowHeight={rowHeight}
          density="compact"
          disableRowSelectionOnClick
          pageSizeOptions={pageSizeOptions}
          initialState={{
            pagination: { paginationModel: { pageSize: initialPageSize, page: 0 } },
            ...(pinnedLeftColumns?.length
              ? { pinnedColumns: { left: pinnedLeftColumns } }
              : undefined),
          }}
          slots={{ footer: () => <Footer content={footer} /> }}
          sx={{ maxHeight: "62vh" }}
        />
      </Box>
    </AsyncState>
  );
}

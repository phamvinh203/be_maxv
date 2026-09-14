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
  // `@mui/x-data-grid` Community KHÔNG hỗ trợ initialState.pinnedColumns (chỉ Pro) —
  // dùng lại kỹ thuật sticky CSS thủ công của BangLuongTable.tsx cũ (hàm dinhTrai()),
  // dựa vào data-field mà DataGrid gắn sẵn trên header/cell.
  // Yêu cầu bắt buộc đi kèm (xem <DataGrid> bên dưới):
  // - disableVirtualization: cột "dính" CSS thuần không được exempt khỏi column
  //   virtualization (đó là cơ chế của Pro state.pinnedColumns) — cuộn ngang xa quá
  //   buffer sẽ bị unmount khỏi DOM, để lại khoảng trống. Grid đã bound theo trang
  //   (tối đa 100 dòng/trang) nên tắt virtualization chấp nhận được.
  // - disableColumnResize: offset `left` tính 1 lần từ `columns` (static), không theo
  //   width thực tế đang render — resize cột sẽ làm lệch offset.
  const pinnedSx = pinnedLeftColumns?.length
    ? (() => {
        let left = 0;
        const styles: Record<string, object> = {};
        for (const field of pinnedLeftColumns) {
          const col = columns.find((c) => c.field === field);
          const width = col?.width ?? col?.minWidth ?? 100;
          styles[`& .MuiDataGrid-columnHeader[data-field="${field}"]`] = {
            position: "sticky",
            left,
            zIndex: 3,
            backgroundColor: "background.paper",
          };
          styles[`& .MuiDataGrid-cell[data-field="${field}"]`] = {
            position: "sticky",
            left,
            zIndex: 2,
            backgroundColor: "background.paper",
          };
          left += width;
        }
        return styles;
      })()
    : undefined;

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
          disableColumnResize
          disableVirtualization
          pageSizeOptions={pageSizeOptions}
          initialState={{
            pagination: { paginationModel: { pageSize: initialPageSize, page: 0 } },
          }}
          slots={{ footer: () => <Footer content={footer} /> }}
          sx={{ maxHeight: "62vh", ...pinnedSx }}
        />
      </Box>
    </AsyncState>
  );
}

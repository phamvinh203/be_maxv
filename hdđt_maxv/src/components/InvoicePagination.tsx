import TablePagination from "@mui/material/TablePagination";

/** Số dòng mỗi trang mặc định. */
export const DEFAULT_ROWS_PER_PAGE = 20;

const ROWS_PER_PAGE_OPTIONS = [20, 50, 100];

const ARIA_LABELS: Record<"first" | "last" | "next" | "previous", string> = {
  first: "Trang đầu",
  previous: "Trang trước",
  next: "Trang sau",
  last: "Trang cuối",
};

interface Props {
  /** Tổng số dòng (toàn bộ, chưa cắt trang). */
  count: number;
  /** Trang hiện tại (0-based). */
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
}

/**
 * Thanh phân trang cho bảng dữ liệu — bọc MUI TablePagination với nhãn tiếng Việt, mặc định 20
 * dòng/trang (chọn được 20/50/100). Phân trang phía client trên dữ liệu đã tải (không gọi lại
 * server khi lật trang). Dùng chung nhiều module (hddt + dich_vu_cong) nên đặt ở `src/components`.
 */
export default function InvoicePagination({
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: Props) {
  return (
    <TablePagination
      component="div"
      count={count}
      page={page}
      rowsPerPage={rowsPerPage}
      rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
      onPageChange={(_e, newPage) => onPageChange(newPage)}
      onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
      labelRowsPerPage="Số dòng mỗi trang:"
      labelDisplayedRows={({ from, to, count: total }) => `${from}–${to} trên ${total}`}
      getItemAriaLabel={(type) => ARIA_LABELS[type]}
    />
  );
}

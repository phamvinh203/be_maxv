import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

interface AsyncStateProps {
  /** Đang tải lần đầu — chưa có dữ liệu để hiện. */
  loading?: boolean;
  /** Thông báo lỗi — có giá trị thì ưu tiên hiện lỗi trước cả loading/empty. */
  error?: string | null;
  /** Tải xong nhưng không có dòng nào. */
  empty?: boolean;
  emptyMessage?: string;
  loadingLabel?: string;
  children: ReactNode;
}

/**
 * Bọc 1 khối nội dung (bảng, danh sách, dashboard...): hiện lỗi, rồi tới loading,
 * rồi tới rỗng, theo đúng thứ tự đó — hết cả ba mới render `children` thật.
 */
export default function AsyncState({
  loading = false,
  error = null,
  empty = false,
  emptyMessage = "Không có dữ liệu.",
  loadingLabel,
  children,
}: AsyncStateProps) {
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (loading) {
    return (
      <Stack spacing={1} sx={{ alignItems: "center", py: 4 }}>
        <CircularProgress size={24} />
        {loadingLabel && (
          <Typography variant="caption" color="text.secondary">
            {loadingLabel}
          </Typography>
        )}
      </Stack>
    );
  }

  if (empty) {
    return (
      <Typography variant="body2" color="text.disabled" sx={{ textAlign: "center", py: 4 }}>
        {emptyMessage}
      </Typography>
    );
  }

  return <>{children}</>;
}

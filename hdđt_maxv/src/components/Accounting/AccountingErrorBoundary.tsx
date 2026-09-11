import { Component, type ErrorInfo, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * RVW-B01: chặn crash trắng cả app khi 1 màn con trong `accounting/*` ném lỗi lúc render
 * (VD API đổi shape mà FE lỡ khai sai kiểu) — trước đây không có ErrorBoundary nào trong
 * app nên lỗi 1 màn làm sập luôn toàn bộ UI. "Thử lại" chỉ reset state cục bộ; điều hướng
 * sang trang khác rồi quay lại cũng tự phục hồi vì React remount route.
 */
export class AccountingErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Chưa có dịch vụ theo dõi lỗi trong app — chỉ log ra console.
    console.error("[AccountingErrorBoundary]", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <Box
        sx={{
          minHeight: 420,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
          py: 6,
        }}
      >
        <Stack
          spacing={1.5}
          sx={{ alignItems: "center", textAlign: "center", maxWidth: 480 }}
        >
          <ErrorOutlineRounded sx={{ fontSize: 40, color: "error.main" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Có lỗi xảy ra khi hiển thị màn hình này
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {this.state.error.message ||
              "Vui lòng thử lại hoặc tải lại trang."}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => this.setState({ error: null })}
          >
            Thử lại
          </Button>
        </Stack>
      </Box>
    );
  }
}

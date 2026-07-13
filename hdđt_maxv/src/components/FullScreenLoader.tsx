import { Box, CircularProgress } from "@mui/material";

/**
 * Màn chờ toàn trang — dùng khi đang khôi phục phiên (GET /auth/me) lúc mở app,
 * tránh nháy sang /login hoặc lộ form đăng nhập trước khi biết đã đăng nhập hay chưa.
 */
export default function FullScreenLoader() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CircularProgress />
    </Box>
  );
}

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/**
 * Màn "Tờ khai" — lập tờ khai thuế GTGT mẫu 01/GTGT từ hóa đơn đã đồng bộ.
 * Khung tạm; phần chọn kỳ, form chỉ tiêu và bảng kê dựng ở các lát sau (xem
 * `docs/superpowers/plans/2026-08-28-lap-to-khai-gtgt01.md`).
 */
export default function ToKhai() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6">Tờ khai thuế GTGT — mẫu 01/GTGT</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Màn hình đang được dựng.
      </Typography>
    </Box>
  );
}

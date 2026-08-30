import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ToKhaiInvoiceTabs from "../../features/to_khai/components/ToKhaiInvoiceTabs";

/**
 * Màn "Tờ khai" — hiện tại là bảng hóa đơn mua vào/bán ra đã đồng bộ, dùng bộ lọc và bộ cột
 * RIÊNG của mô-đun này (`features/to_khai/`), tách khỏi màn Hóa đơn điện tử để sau đổi cột
 * theo nhu cầu lập tờ khai mà không ảnh hưởng bên kia.
 */
export default function ToKhai() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Tờ khai
      </Typography>
      <ToKhaiInvoiceTabs />
    </Box>
  );
}

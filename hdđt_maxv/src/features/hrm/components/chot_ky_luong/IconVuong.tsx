import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";

/** Ô vuông bo góc nền nhạt chứa một icon — dùng ở header màn Chốt kỳ lương và trên từng thẻ bảng kê. */
export default function IconVuong({ mau, children }: { mau: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: 1.5,
        display: "grid",
        placeItems: "center",
        color: mau,
        bgcolor: alpha(mau, 0.1),
      }}
    >
      {children}
    </Box>
  );
}

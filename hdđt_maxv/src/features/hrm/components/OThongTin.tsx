import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface Props {
  nhan: string;
  giaTri: ReactNode;
}

/** Một ô nhãn — giá trị ở các màn hình xem chi tiết (chỉ đọc). */
export default function OThongTin({ nhan, giaTri }: Props) {
  const rong = giaTri === null || giaTri === undefined || giaTri === "";
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {nhan}
      </Typography>
      {rong ? (
        <Typography variant="body2" sx={{ color: "text.disabled" }}>
          —
        </Typography>
      ) : typeof giaTri === "string" || typeof giaTri === "number" ? (
        <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: "break-word" }}>
          {giaTri}
        </Typography>
      ) : (
        giaTri
      )}
    </Box>
  );
}

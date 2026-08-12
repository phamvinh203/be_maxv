import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

interface Props {
  tieuDe: string;
  moTa?: string;
  icon?: ReactNode;
  children: ReactNode;
  /** Số cột tối đa của lưới ô nhập. Mặc định 3. */
  soCot?: 2 | 3;
}

/** Khung một nhóm cấu hình — tiêu đề, mô tả ngắn, lưới ô nhập bên dưới. */
export default function NhomCauHinh({
  tieuDe,
  moTa,
  icon,
  children,
  soCot = 3,
}: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: moTa ? 0.5 : 2 }}>
        {icon}
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {tieuDe}
        </Typography>
      </Stack>
      {moTa && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {moTa}
        </Typography>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
            lg: soCot === 3 ? "1fr 1fr 1fr" : "1fr 1fr",
          },
          gap: 2,
        }}
      >
        {children}
      </Box>
    </Paper>
  );
}

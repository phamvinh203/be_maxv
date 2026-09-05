import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import BuildRounded from "@mui/icons-material/BuildRounded";
import { alpha } from "@mui/material/styles";

interface Props {
  /** Tên màn hình, đúng nhãn của tab đang mở. */
  ten: string;

  /** Một câu mô tả màn hình sẽ làm gì. */
  moTa?: string;
}

export default function ManHinhDangPhatTrien({ ten, moTa }: Props) {
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
      <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center", maxWidth: 480 }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "warning.main",
            bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
          }}
        >
          <BuildRounded sx={{ fontSize: 26 }} />
        </Box>

        <Chip
          size="small"
          label="Đang phát triển"
          sx={{
            fontWeight: 500,
            color: "warning.dark",
            bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
          }}
        />

        <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 0.5 }}>
          {ten}
        </Typography>

        {moTa && (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {moTa}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

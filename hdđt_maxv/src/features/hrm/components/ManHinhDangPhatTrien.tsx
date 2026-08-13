import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import ConstructionRounded from "@mui/icons-material/ConstructionRounded";
import { alpha } from "@mui/material/styles";

interface Props {
  /** Tên màn hình, đúng nhãn của tab đang mở. */
  ten: string;
  /** Một câu nói màn hình này sẽ làm gì — để người dùng biết mình vào đúng chỗ. */
  moTa?: string;
}

/**
 * Màn hình chưa dựng xong.
 *
 * Nói thẳng là "đang phát triển" thay vì để trang trắng hay chặn không cho bấm
 * vào tab: người dùng cần biết chức năng đó **có tồn tại** và đang tới, chứ tab
 * bấm vào không ra gì thì trông như phần mềm hỏng.
 */
export default function ManHinhDangPhatTrien({ ten, moTa }: Props) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 4, md: 8 } }}>
      <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: "50%",
            color: "warning.main",
            bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
          }}
        >
          <ConstructionRounded sx={{ fontSize: 36 }} />
        </Box>

        <Chip size="small" color="warning" variant="outlined" label="Đang phát triển" />

        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {ten}
        </Typography>

        {moTa && (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
            {moTa}
          </Typography>
        )}

        <Typography variant="caption" color="text.disabled">
          Màn hình này sẽ có ở bản sau.
        </Typography>
      </Stack>
    </Paper>
  );
}

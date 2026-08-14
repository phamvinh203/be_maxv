import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ConstructionRounded from "@mui/icons-material/ConstructionRounded";

import AppHeader from "../../components/AppHeader";

export default function AccountingPage() {
  return (
    <>
      <AppHeader />
      <Stack
        sx={{
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 1.5,
          textAlign: "center",
        }}
      >
        <ConstructionRounded sx={{ fontSize: 48, color: "text.disabled" }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Kế toán đang phát triển
        </Typography>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Tính năng này sẽ sớm ra mắt.
          </Typography>
        </Box>
      </Stack>
    </>
  );
}
